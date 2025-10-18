import os
import time
import re
from openai import OpenAI
import time, logging
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
        self.default_model = default_model or "gpt-4"

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

        logging.warning(f"OpenAIProvider._stream_request() using model: {chosen_model}")

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

    def list_models(self) -> list[str]:
        try:
            resp = self.client.models.list()
            items = getattr(resp, "data", []) or []

            def ends_with_snapshot(mid: str) -> bool:
                # Drop dated snapshots (-YYYY[-MM[-DD]]) and numeric snapshots (-0125, -1106)
                return bool(re.search(r"-(?:20\d{2}(?:-\d{2}){0,2}|\d{4})$", mid))

            def is_chat_model(m) -> bool:
                mid = getattr(m, "id", "") or ""
                lid = mid.lower()
                banned = (
                    "embedding", "embeddings", "whisper", "tts", "audio",
                    "image", "realtime", "moderation", "preview", "transcribe", "search-api"
                )
                if any(b in lid for b in banned):
                    return False
                if ends_with_snapshot(lid):
                    return False
                return lid.startswith("gpt-")

            models = [m for m in items if is_chat_model(m)]

            # Prefer '-latest' aliases
            latest_ids = [m.id for m in models if isinstance(m.id, str) and m.id.endswith("-latest")]
            # Then newest by created timestamp
            rest = [m for m in models if m.id not in latest_ids]
            try:
                rest.sort(key=lambda m: int(getattr(m, "created", 0) or 0), reverse=True)
            except Exception:
                pass
            ordered = latest_ids + [m.id for m in rest if isinstance(m.id, str)]

            # Deduplicate and cap to a small, relevant set
            unique_ordered = list(dict.fromkeys(ordered))
            return unique_ordered[:25]
        except Exception as e:
            raise RuntimeError(f"OpenAI list models error: {e}")