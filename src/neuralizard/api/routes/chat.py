import asyncio, logging, re, time, uuid
from typing import Iterable, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from neuralizard.providers import get_provider, get_available_providers
from neuralizard.db import (
    create_conversation,
    add_message,
    update_message_content,
    session,
    Conversation,
    Message,
    add_message_rating,
)

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    prompt: str
    provider: str = "openai"
    model: str | None = None
    temperature: float | None = 0.7


@router.get("/ping")
def ping():
    return {"status": "ok"}


@router.post("/complete")
def complete(body: ChatRequest):
    try:
        prov = get_provider(body.provider)
        res = prov.complete(body.prompt, model=body.model, temperature=body.temperature)
        return {"text": res.text, "provider": res.provider, "model": res.model}
    except Exception as e:
        raise HTTPException(500, f"Provider error: {e}")


@router.post("/stream")
def stream(body: ChatRequest):
    try:
        prov = get_provider(body.provider)
    except Exception as e:
        raise HTTPException(400, str(e))

    def gen():
        try:
            for chunk in prov.stream(body.prompt, model=body.model, temperature=body.temperature):
                if isinstance(chunk, str):
                    yield chunk
        except Exception as e:
            yield f"\n[ERROR: {e}]"

    return StreamingResponse(gen(), media_type="text/plain")


@router.websocket("/ws")
async def chat_ws(ws: WebSocket):
    await ws.accept()
    await ws.send_json({"type": "info", "message": "Connected. Send JSON frames."})

    # Do NOT auto-create conversations; create on demand
    conversation_id: Optional[uuid.UUID] = None
    current_provider = "openai"
    memory: list[dict[str, str]] = []
    max_messages = 50

    def build_context(user_prompt: str) -> str:
        parts: list[str] = []
        for m in memory:
            parts.append(f"{'User' if m['role']=='user' else 'Assistant'}: {m['content']}")
        parts.append(f"User: {user_prompt}")
        parts.append("Assistant:")
        return "\n".join(parts)

    async def stream_provider(gen: Iterable[str], q: asyncio.Queue):
        try:
            for raw in gen:
                if not isinstance(raw, str):
                    continue
                for piece in re.split(r"(\s+)", raw):
                    if piece:
                        await q.put(piece)
        finally:
            await q.put(None)

    async def maybe_create_title(first_user: str, assistant_text: str, provider_name: str, model: str | None, cid: uuid.UUID):
        # Only try if no title in DB yet
        with session() as s:
            db_conv = s.get(Conversation, cid)
            if not db_conv or db_conv.title:
                return

        def build_title_prompt() -> str:
            return (
                "Create a short, descriptive chat title (max 6 words). "
                "No quotes, no trailing punctuation, concise.\n\n"
                f"User: {first_user.strip()}\n"
                f"Assistant: {assistant_text.strip()}\n\n"
                "Title:"
            )

        try:
            prov = get_provider(provider_name)
            prompt_txt = build_title_prompt()
            res = await asyncio.wait_for(
                asyncio.to_thread(lambda: prov.complete(prompt_txt, model=model, temperature=0.2)),
                timeout=15.0,
            )
            raw_title = (getattr(res, "text", "") or "").strip()
            if not raw_title:
                logging.warning("Title generation returned empty text")
                return
            title = raw_title.replace("\n", " ").strip().strip('"').strip("'")
            title = re.sub(r"[.?!]+$", "", title).strip()
            if len(title) > 80:
                title = title[:80].rstrip()
            if not title:
                logging.warning("Title post-processing produced empty title")
                return
        except asyncio.TimeoutError:
            logging.warning("Title generation timed out")
            return
        except Exception as e:
            logging.exception(f"Title generation failed: {e}")
            return

        try:
            with session() as s:
                db = s.get(Conversation, cid)
                if db and not db.title:
                    db.title = title
                    s.commit()
            await ws.send_json({"type": "conversation_title", "id": str(cid), "title": title})
        except Exception:
            pass

    try:
        while True:
            try:
                data = await ws.receive_json()
            except WebSocketDisconnect:
                break
            except Exception:
                await ws.send_json({"type": "error", "error": "Invalid JSON"})
                continue

            t = data.get("type")

            # Explicitly create a new chat when user clicks "New chat"
            if t == "new_chat":
                prov_req = (data.get("provider") or current_provider) or "openai"
                try:
                    conv = create_conversation(default_provider=prov_req)
                    conversation_id = conv.id
                    current_provider = conv.default_provider or prov_req
                    memory.clear()
                    await ws.send_json({
                        "type": "conversation_created",
                        "id": str(conversation_id),
                        "provider": current_provider,
                        "title": conv.title or "New chat",
                    })
                except Exception as e:
                    await ws.send_json({"type": "error", "error": f"Create chat failed: {e}"})
                continue

            # History and conversation detail handlers
            if t == "history":
                limit = int(data.get("limit", 50))
                offset = int(data.get("offset", 0))
                items: list[dict] = []
                with session() as s:
                    convs = (
                        s.query(Conversation)
                        .order_by(Conversation.updated_at.desc())
                        .offset(offset)
                        .limit(limit)
                        .all()
                    )
                    conv_ids = [c.id for c in convs]
                    msgs_by_conv: dict[uuid.UUID, list[Message]] = {cid: [] for cid in conv_ids}
                    if conv_ids:
                        all_msgs = (
                            s.query(Message)
                            .filter(Message.conversation_id.in_(conv_ids))
                            .order_by(Message.created_at.asc())
                            .all()
                        )
                        for m in all_msgs:
                            msgs_by_conv[m.conversation_id].append(m)

                    for c in convs:
                        conv_msgs = msgs_by_conv.get(c.id, [])
                        last = conv_msgs[-1] if conv_msgs else None
                        preview = None
                        if last and last.content:
                            preview = last.content[:160] + ("…" if len(last.content) > 160 else "")
                        items.append(
                            {
                                "id": str(c.id),
                                "title": c.title or "New chat",
                                "started_at": c.started_at.isoformat(),
                                "updated_at": c.updated_at.isoformat(),
                                "default_provider": c.default_provider,
                                "default_model": c.default_model,
                                "message_count": len(conv_msgs),
                                "last_message_preview": preview,
                                "messages": [
                                    {
                                        "id": m.id,
                                        "role": m.role,
                                        "content": m.content,
                                        "provider": m.provider,
                                        "model": m.model,
                                        "created_at": m.created_at.isoformat(),
                                        "latency_ms": m.latency_ms,
                                        "first_token_ms": m.first_token_ms,
                                        "error": m.error,
                                        "prompt_tokens": m.prompt_tokens,
                                        "response_tokens": m.response_tokens,
                                    }
                                    for m in conv_msgs
                                ],
                            }
                        )
                await ws.send_json({"type": "history", "items": items, "offset": offset, "limit": limit})
                continue

            if t in ("conversation", "conversation_detail"):
                cid = data.get("id") or data.get("conversation_id")
                if not cid:
                    await ws.send_json({"type": "error", "error": "Missing conversation id"})
                    continue
                try:
                    conv_uuid = uuid.UUID(str(cid))
                except Exception:
                    await ws.send_json({"type": "error", "error": "Invalid conversation id"})
                    continue
                with session() as s:
                    msgs = (
                        s.query(Message)
                        .filter(Message.conversation_id == conv_uuid)
                        .order_by(Message.created_at.asc())
                        .all()
                    )

                    memory.clear()
                    # Rebuild in-memory context from this conversation (cap by max_messages)
                    memory[:] = [
                        {"role": m.role, "content": m.content}
                        for m in msgs
                        if m.role in ("user", "assistant") and m.content
                    ]
                    if len(memory) > max_messages:
                        memory[:] = memory[-max_messages:]           

                    payload = [
                        {
                            "id": m.id,
                            "role": m.role,
                            "content": m.content,
                            "provider": m.provider,
                            "model": m.model,
                            "created_at": m.created_at.isoformat(),
                            "latency_ms": m.latency_ms,
                            "first_token_ms": m.first_token_ms,
                            "error": m.error,
                            "prompt_tokens": m.prompt_tokens,
                            "response_tokens": m.response_tokens,
                        }
                        for m in msgs
                    ]
                await ws.send_json({"type": "conversation", "id": str(conv_uuid), "messages": payload})
                continue

            if t == "providers" or data.get("action") == "providers":
                await ws.send_json({"type": "providers", "providers": get_available_providers()})
                continue

            if t == "set_provider":
                requested = (data.get("provider") or "").lower().strip()
                if not requested:
                    await ws.send_json({"type": "error", "error": "Missing provider"})
                    continue
                if requested not in get_available_providers():
                    await ws.send_json({"type": "error", "error": f"Provider not available: {requested}"})
                    continue
                current_provider = requested
                await ws.send_json({"type": "provider_changed", "provider": current_provider})
                continue

            # Allow provider-only frames
            if not data.get("prompt") and data.get("provider"):
                requested = (data.get("provider") or "").lower().strip()
                if requested and requested != current_provider:
                    if requested not in get_available_providers():
                        await ws.send_json({"type": "error", "error": f"Provider not available: {requested}"})
                        continue
                    current_provider = requested
                    await ws.send_json({"type": "provider_changed", "provider": current_provider})
                continue

            # === Delete conversation ===
            if t == "delete_conversation":
                cid = data.get("id") or data.get("conversation_id")
                if not cid:
                    await ws.send_json({"type": "error", "error": "Missing conversation id"})
                    continue
                try:
                    conv_uuid = uuid.UUID(str(cid))
                except Exception:
                    await ws.send_json({"type": "error", "error": "Invalid conversation id"})
                    continue

                try:
                    with session() as s:
                        # Delete messages first (if no DB cascade)
                        s.query(Message).filter(Message.conversation_id == conv_uuid).delete(synchronize_session=False)
                        # Delete the conversation
                        s.query(Conversation).filter(Conversation.id == conv_uuid).delete(synchronize_session=False)
                        s.commit()
                    # Clear current selection if we deleted it
                    if conversation_id == conv_uuid:
                        conversation_id = None
                        memory.clear()
                    await ws.send_json({"type": "conversation_deleted", "id": str(conv_uuid)})
                except Exception as e:
                    await ws.send_json({"type": "error", "error": f"Delete failed: {e}"})
                continue

            # === Rate a message (vote/score/label/comment) ===
            if t in ("rate", "rating"):
                mid = data.get("message_id") or data.get("id")
                if mid is None:
                    await ws.send_json({"type": "error", "error": "Missing message_id"})
                    continue
                try:
                    mid_int = int(mid)
                except Exception:
                    await ws.send_json({"type": "error", "error": "Invalid message_id"})
                    continue

                # Validate vote and score
                vote = int(data.get("vote", 0))
                if vote not in (-1, 0, 1):
                    await ws.send_json({"type": "error", "error": "vote must be -1, 0, or 1"})
                    continue
                score = data.get("score")
                if score is not None:
                    try:
                        score = int(score)
                    except Exception:
                        await ws.send_json({"type": "error", "error": "score must be integer 1..5"})
                        continue
                    if not (1 <= score <= 5):
                        await ws.send_json({"type": "error", "error": "score must be between 1 and 5"})
                        continue

                label = (data.get("label") or None)
                comment = (data.get("comment") or None)
                user_id = (data.get("user_id") or None)

                try:
                    rec = add_message_rating(
                        message_id=mid_int,
                        user_id=user_id,
                        vote=vote,
                        score=score,
                        label=label,
                        comment=comment,
                    )
                    await ws.send_json(
                        {
                            "type": "rating",
                            "ok": True,
                            "id": rec.id,
                            "message_id": mid_int,
                            "vote": vote,
                            "score": score,
                            "label": label,
                            "comment": comment,
                            "created_at": rec.created_at.isoformat(),
                        }
                    )
                except Exception as e:
                    await ws.send_json({"type": "error", "error": f"Rating failed: {e}"})
                continue

            # === Chat prompt ===
            prompt = (data.get("prompt") or "").strip()
            if not prompt:
                await ws.send_json({"type": "error", "error": "Empty prompt"})
                continue

            # Determine which conversation to write to
            cid_in = data.get("conversation_id")
            use_cid: Optional[uuid.UUID] = None
            if cid_in:
              try:
                use_cid = uuid.UUID(str(cid_in))
              except Exception:
                await ws.send_json({"type": "error", "error": "Invalid conversation id"})
                continue
            else:
              use_cid = conversation_id

            if not use_cid:
                await ws.send_json({"type": "error", "error": "No conversation selected. Create one first."})
                continue

            provider_name = (data.get("provider") or current_provider).lower()
            model = data.get("model")
            temperature = data.get("temperature", 0.7)

            t0 = time.perf_counter()
            first_token_time = None

            try:
                prov = get_provider(provider_name)
            except Exception as e:
                await ws.send_json({"type": "error", "error": f"Provider load failed: {e}"})
                continue

            add_message(
                conversation_id=use_cid,
                role="user",
                content=prompt,
                provider=provider_name,
                model=model,
                prompt_tokens=0,
            )
            memory.append({"role": "user", "content": prompt})
            if len(memory) > max_messages:
                memory[:] = memory[-max_messages:]

            ctx = build_context(prompt)

            logging.warning(ctx)
            await ws.send_json({"type": "start", "provider": provider_name, "model": model})
            q: asyncio.Queue[str | None] = asyncio.Queue()
            assistant_chunks: list[str] = []

            assistant = add_message(
                conversation_id=use_cid,
                role="assistant",
                content="",
                provider=provider_name,
                model=model,
            )
            assistant_id = assistant.id

            try:
                gen = prov.stream(ctx, model=model, temperature=temperature)
                asyncio.create_task(stream_provider(gen, q))
                while True:
                    piece = await q.get()
                    if piece is None:
                        break
                    if first_token_time is None:
                        first_token_time = time.perf_counter()
                    assistant_chunks.append(piece)
                    await ws.send_json({"type": "delta", "data": piece})

                text_out = "".join(assistant_chunks).strip()
                memory.append({"role": "assistant", "content": text_out})
                await ws.send_json({"type": "done", "message_id": assistant_id})

                latency_ms = int((time.perf_counter() - t0) * 1000)
                first_token_ms = int((first_token_time - t0) * 1000) if first_token_time else latency_ms
                update_message_content(
                    assistant_id,
                    content=text_out,
                    latency_ms=latency_ms,
                    first_token_ms=first_token_ms,
                )

                # Create title for this conversation only
                await maybe_create_title(first_user=prompt, assistant_text=text_out, provider_name=provider_name, model=model, cid=use_cid)

            except Exception as e:
                err = str(e)
                await ws.send_json({"type": "error", "error": err})
                update_message_content(assistant_id, content="".join(assistant_chunks), error=err)
                continue
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await ws.send_json({"type": "error", "error": f"Fatal: {e}"})
        finally:
            await ws.close()