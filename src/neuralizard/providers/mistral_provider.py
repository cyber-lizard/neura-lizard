import os
import time
from mistralai import Mistral
from .base import LLMResult
from .base_streaming import StreamingProviderMixin


class MistralProvider(StreamingProviderMixin):
    """
    Mistral provider (single + streaming).
    """

    name = "mistral"

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or os.getenv("MISTRAL_API_KEY")
        if not self.api_key:
            raise RuntimeError("MISTRAL_API_KEY missing. Add it to ~/.neuralizard/.env")
        self.client = Mistral(api_key=self.api_key)
        self.default_model = "mistral-large-latest"

    # -------- Non‑streaming --------
    def complete(self, prompt: str, model: str | None = None, **kwargs) -> LLMResult:
        chosen_model = model or self.default_model
        t0 = time.time()
        try:
            resp = self.client.chat.complete(
                model=chosen_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=kwargs.get("temperature", 0.7),
                max_tokens=kwargs.get("max_tokens", 1024),
            )
        except Exception as e:
            raise RuntimeError(f"Mistral API error: {e}")

        text = resp.choices[0].message.content
        usage = getattr(resp, "usage", {}) or {}
        return LLMResult(
            text=text.strip(),
            provider=self.name,
            model=chosen_model,
            prompt_tokens=usage.get("prompt_tokens", 0),
            response_tokens=usage.get("completion_tokens", 0),
            latency_ms=int((time.time() - t0) * 1000),
        )

    # -------- Streaming (used by mixin) --------
    def _stream_request(self, prompt: str, model: str | None = None, **kwargs):
        """
        Yield incremental text chunks. Defensive against SDK variations
        (some events lack .type; use .event_type or class name).
        """
        chosen_model = model or self.default_model
        debug = kwargs.get("debug", False)

        try:
            # Some SDKs: self.client.chat.stream(...)
            with self.client.chat.stream(
                model=chosen_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=kwargs.get("temperature", 0.7),
                max_tokens=kwargs.get("max_tokens", 1024),
            ) as stream:
                for event in stream:
                    etype = (
                        getattr(event, "type", None)
                        or getattr(event, "event_type", None)
                        or getattr(event, "event", None)
                        or event.__class__.__name__
                    )

                    if debug:
                        yield f"[DEBUG {etype}]"

                    # Known delta patterns
                    # Pattern A: event.data.delta.content (list or str)
                    delta_obj = getattr(getattr(event, "data", None), "delta", None)
                    if delta_obj:
                        content = getattr(delta_obj, "content", None)
                        if isinstance(content, str) and content:
                            yield content
                            continue
                        if isinstance(content, list):
                            for part in content:
                                if isinstance(part, str) and part:
                                    yield part
                            continue

                    # Pattern B: direct message chunk (fallback)
                    if hasattr(event, "data") and hasattr(event.data, "choices"):
                        try:
                            choices = event.data.choices
                            if choices:
                                piece = getattr(choices[0].delta, "content", None)
                                if piece:
                                    if isinstance(piece, str):
                                        yield piece
                                    elif isinstance(piece, list):
                                        for p in piece:
                                            if isinstance(p, str):
                                                yield p
                        except Exception:
                            pass

                    # Completion / stop signals
                    if any(k in str(etype).lower() for k in ("completed", "stop", "end")):
                        break

                    # Errors
                    if "error" in str(etype).lower():
                        err = getattr(event, "error", None) or getattr(getattr(event, "data", None), "error", None)
                        yield f"[ERROR: {err}]"
                        break

        except Exception as e:
            yield f"[Stream error: {e}]"