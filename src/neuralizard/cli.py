import typer
from rich import print
from rich.console import Console
from typing import Optional
from .config import settings, APP_DIR
from .db import init_db, session, Interaction
from .providers import get_provider

app = typer.Typer(add_completion=False)
console = Console()


# ============================================================
# ⚙️ INIT
# ============================================================

@app.command()
def init():
    """Initialize DB schema (Postgres) and ensure env file."""
    init_db()
    env = APP_DIR / ".env"
    if not env.exists():
        env.write_text("OPENAI_API_KEY=\n")
    print(f"[green]Initialized[/green] DB (url={settings.db_url}) and env at {env}")


# ============================================================
# 💬 ASK
# ============================================================

@app.command()
def ask(
    prompt: str,
    provider: str = typer.Option(settings.default_provider, "--provider", "-p"),
    model: Optional[str] = typer.Option(None, "--model", "-m"),
    category: Optional[str] = typer.Option(None, "--category", "-c"),
):
    """Send a prompt, print answer, log interaction"""
    prov = get_provider(provider)
    res = prov.complete(prompt, model)

    with session() as s:
        inter = Interaction(
            provider=res.provider,
            model=res.model,
            prompt=prompt,
            response=res.text,
            prompt_tokens=res.prompt_tokens,
            response_tokens=res.response_tokens,
            latency_ms=res.latency_ms,
            category=category,
            rating=None,
            source_app="cli",
        )
        s.add(inter)
        s.commit()
        print(f"[bold cyan]#{inter.id}[/bold cyan] {res.provider}/{res.model} [{res.latency_ms} ms]")
        print()
        print(res.text)


# ============================================================
# 🧠 CHAT (interactive, streaming)
# ============================================================

@app.command()
def chat(
    provider: str = typer.Option(settings.default_provider, "--provider", "-p"),
    model: Optional[str] = typer.Option(None, "--model", "-m"),
):
    """Start an interactive chat with streaming output."""
    console.print(
        f"[bold green]💬 Chat started with {provider} ({model or 'default model'})[/bold green]"
    )
    console.print("[dim]Type 'exit' or press Ctrl+C to quit. Use '/clear' to reset context.[/dim]\n")

    prov = get_provider(provider)
    history = []

    while True:
        try:
            user_input = console.input("[bold cyan]You:[/bold cyan] ").strip()
            if not user_input:
                continue
            if user_input.lower() in {"exit", "quit"}:
                console.print("[yellow]👋 Goodbye![/yellow]")
                break
            if user_input == "/clear":
                history.clear()
                console.print("[blue]🧹 Context cleared.[/blue]")
                continue

            history.append({"role": "user", "content": user_input})
            prompt = "\n".join(f"{m['role']}: {m['content']}" for m in history)

            # Stream tokens from provider
            console.print(f"[bold magenta]{provider.title()}:[/bold magenta] ", end="")
            buffer = ""
            for token in prov.stream(prompt, model=model):
                console.print(token, end="", style="white", soft_wrap=True)
                buffer += token
            console.print("\n")

            history.append({"role": "assistant", "content": buffer})

            # Log this interaction to DB
            with session() as s:
                inter = Interaction(
                    provider=prov.name,
                    model=model or getattr(prov, "default_model", "unknown"),
                    prompt=user_input,
                    response=buffer,
                    prompt_tokens=0,
                    response_tokens=0,
                    latency_ms=0,
                    category="chat",
                    rating=None,
                    source_app="cli-chat",
                )
                s.add(inter)
                s.commit()
                console.print(f"[dim]💾 Saved as interaction #{inter.id}[/dim]")

        except KeyboardInterrupt:
            console.print("\n[red]💤 Interrupted. Goodbye![/red]")
            break
        except Exception as e:
            console.print(f"[red]Error:[/red] {e}")


# ============================================================
# ⭐ RATE
# ============================================================

@app.command()
def rate(id: int, value: str):
    """Mark an interaction as good/bad"""
    if value not in {"good", "bad"}:
        raise typer.BadParameter('Value must be "good" or "bad"')
    with session() as s:
        inter = s.get(Interaction, id)
        if not inter:
            raise typer.BadParameter(f"Interaction {id} not found")
        inter.rating = value
        s.commit()
        print(f"[green]Updated[/green] #{id} rating -> {value}")


# ============================================================
# 📜 LOG
# ============================================================

@app.command()
def log(last: int = typer.Option(10, "--last", "-n")):
    """Show recent interactions"""
    with session() as s:
        rows = s.query(Interaction).order_by(Interaction.id.desc()).limit(last).all()
        for r in rows:
            title = (r.prompt[:80] + "…") if len(r.prompt) > 80 else r.prompt
            print(f"[bold cyan]#{r.id}[/bold cyan] {r.provider}/{r.model} [{r.ts}] [{r.rating or '-'}]")
            print(f"  {title}\n")


# ============================================================
# 🏁 ENTRY POINT
# ============================================================

if __name__ == "__main__":
    app()
