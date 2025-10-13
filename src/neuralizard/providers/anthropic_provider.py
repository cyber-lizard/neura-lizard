import os
import time
import anthropic
from typing import Any
from .base import LLMResult
from .base_streaming import StreamingProviderMixin
from ._usage import usage_get


class AnthropicProvider(StreamingProviderMixin):
    """
    Provider wrapper for Anthropic Claude models (Claude 3, 3.5, etc.)
    Supports both single responses and streaming token-by-token output.
    """

    name = "anthropic"

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        if not self.api_key:
            raise RuntimeError("ANTHROPIC_API_KEY missing. Add it to ~/.neuralizard/.env")
        self.client = anthropic.Anthropic(api_key=self.api_key)
        self.default_model = "claude-sonnet-4-20250514"

    # ============================================================
    # 🔹 Single complete
    # ============================================================

    def complete(self, prompt: str, model: str | None = None, temperature: float | None = None):
        """Send a single prompt to the Claude API."""
        chosen_model = model or self.default_model
        t0 = time.time()

        try:
            resp = self.client.messages.create(
                model=chosen_model,
                max_tokens=kwargs.get("max_tokens", 1024),
                temperature=kwargs.get("temperature", 0.7),
                messages=[{"role": "user", "content": prompt}],
            )
        except Exception as e:
            raise RuntimeError(f"Anthropic API error: {e}")

        usage = getattr(resp, "usage", None)
        # Claude typically returns content list with text
        text = ""
        try:
            content = getattr(resp, "content", None) or []
            if content and hasattr(content[0], "text"):
                text = content[0].text
        except Exception:
            text = getattr(resp, "text", "") or ""

        return LLMResult(
            text=(text or "").strip(),
            provider=self.name,
            model=chosen_model,
            prompt_tokens=usage_get(usage, "input_tokens", usage_get(usage, "prompt_tokens", 0)),
            response_tokens=usage_get(usage, "output_tokens", usage_get(usage, "completion_tokens", 0)),
            latency_ms=int((time.time() - t0) * 1000),
        )

    # ============================================================
    # 🔹 Streaming complete
    # ============================================================

    def _stream_request(self, prompt: str, model: str | None = None, **kwargs):
        """
        Stream Claude responses token-by-token.
        """
        chosen_model = model or self.default_model
        debug = kwargs.get("debug", False)

        try:
            with self.client.messages.stream(
                model=chosen_model,
                max_tokens=kwargs.get("max_tokens", 1024),
                temperature=kwargs.get("temperature", 0.7),
                messages=[{"role": "user", "content": prompt}],
            ) as stream:
                for event in stream:
                    et = getattr(event, "type", None)
                    if et == "content_block_delta":
                        # event.delta is a TextDelta object (not a dict)
                        delta_obj = getattr(event, "delta", None)
                        text = getattr(delta_obj, "text", "")
                        if text:
                            yield text
                    elif et in ("message_start", "content_block_start", "message_delta", "content_block_stop"):
                        if debug:
                            yield f"[DEBUG {et}]"
                        continue
                    elif et == "message_stop":
                        break
                    elif et == "error":
                        err = getattr(event, "error", None)
                        yield f"[ERROR: {err}]"
                        break
        except Exception as e:
            yield f"[Stream error: {e}]"