import os
import time
from openai import OpenAI
from .base import LLMResult
from .base_streaming import StreamingProviderMixin
from typing import Any
from ._usage import usage_get


class OpenAIProvider(StreamingProviderMixin):
    """
    OpenAI provider (simple).
    - complete(): non‑streaming
    - stream(): provided by StreamingProviderMixin, uses _stream_request()
    """
    name = "openai"

    def __init__(self, api_key: str | None = None, default_model: str | None = None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise RuntimeError("OPENAI_API_KEY not found (set env or add to ~/.neuralizard/.env)")
        self.client = OpenAI(api_key=self.api_key)
        self.default_model = default_model or "gpt-4o-mini"

    # ---------------- Non‑streaming ----------------
    def complete(self, prompt: str, model: str | None = None, temperature: float | None = None):
        chosen_model = model or self.default_model

        t0 = time.time()
        try:
            resp = self.client.chat.completions.create(
                model=chosen_model,
                messages=[{"role": "user", "content": prompt}],
            )
        except Exception as e:
            raise RuntimeError(f"OpenAI API error: {e}")

        usage = getattr(resp, "usage", None)

        msg = resp.choices[0].message.content

        return LLMResult(
            text=msg.strip(),
            provider=self.name,
            model=chosen_model,
            # FIX: safe accessor for typed usage objects
            prompt_tokens=usage_get(usage, "prompt_tokens", 0),
            response_tokens=usage_get(usage, "completion_tokens", usage_get(usage, "response_tokens", 0)),
            latency_ms=int((time.time() - t0) * 1000),
        )

    # ---------------- Streaming (used by mixin) ----------------
    def _stream_request(self, prompt: str, model: str | None = None, **kwargs):
        """
        Yield plain text chunks. Observed event types:
          - content.delta  (event.delta -> str piece)
          - content.done   (final; stop)
        """
        chosen_model = model or self.default_model
        debug = kwargs.get("debug", False)

        try:
            with self.client.chat.completions.stream(
                model=chosen_model,
                messages=[{"role": "user", "content": prompt}],
            ) as stream:
                for event in stream:
                    etype = getattr(event, "type", None)
                    if etype == "content.delta":
                        delta = getattr(event, "delta", "")
                        if delta:
                            yield delta
                    elif etype in ("content.done", "message.completed"):
                        break
                    elif etype in ("error", "response.error"):
                        err = getattr(event, "error", None)
                        yield f"[ERROR: {err}]"
                        break
                    elif debug:
                        # Minimal debug (only if requested)
                        yield f"[DEBUG {etype}]"
        except Exception as e:
            yield f"[Streaming error: {e}]"