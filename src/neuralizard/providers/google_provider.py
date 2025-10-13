import os
import time
import google.generativeai as genai
from typing import Any
from .base import LLMResult
from .base_streaming import StreamingProviderMixin
from ._usage import usage_get


class GoogleProvider(StreamingProviderMixin):
    """
    Provider wrapper for Google Gemini models (Gemini 1.5, etc.).
    Supports both standard and streaming generation.
    """

    name = "google"

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or os.getenv("GOOGLE_API_KEY")
        if not self.api_key:
            raise RuntimeError("GOOGLE_API_KEY missing. Add it to ~/.neuralizard/.env")
        genai.configure(api_key=self.api_key)
        self.default_model = "gemini-2.5-flash"

    # ============================================================
    # 🔹 Single completion
    # ============================================================

    def complete(self, prompt: str, model: str | None = None, **kwargs) -> LLMResult:
        """Send a single prompt to the Gemini API."""
        chosen_model = model or self.default_model
        t0 = time.time()

        try:
            model_instance = genai.GenerativeModel(chosen_model)
            response = model_instance.generate_content(
                prompt,
                generation_config={
                    "temperature": kwargs.get("temperature", 0.7),
                    "max_output_tokens": kwargs.get("max_tokens", 1024),
                },
            )
        except Exception as e:
            raise RuntimeError(f"Google Gemini API error: {e}")

        text = getattr(response, "text", None)
        if not text:
            # robust candidate extraction
            text = ""
            candidates = getattr(response, "candidates", None) or []
            if candidates:
                try:
                    parts = getattr(candidates[0], "content", {}).get("parts", [])
                    text = "".join(getattr(p, "text", "") for p in parts)
                except Exception:
                    pass

        usage = getattr(response, "usage_metadata", None)

        return LLMResult(
            text=(text or "").strip(),
            provider=self.name,
            model=chosen_model,
            # FIX: safe accessor for typed usage objects
            prompt_tokens=usage_get(usage, "prompt_token_count", 0),
            response_tokens=usage_get(usage, "candidates_token_count", 0),
            latency_ms=int((time.time() - t0) * 1000),
        )

    # ============================================================
    # 🔹 Streaming completion
    # ============================================================

    def _stream_request(self, prompt: str, model: str | None = None, **kwargs):
        """
        Stream content from Gemini using the SDK's generate_content(..., stream=True)
        """
        chosen_model = model or self.default_model

        try:
            model_instance = genai.GenerativeModel(chosen_model)
            stream = model_instance.generate_content(
                prompt,
                generation_config={
                    "temperature": kwargs.get("temperature", 0.7),
                    "max_output_tokens": kwargs.get("max_tokens", 1024),
                },
                stream=True,
            )

            for chunk in stream:
                # each chunk contains candidate parts; yield text tokens
                if hasattr(chunk, "text") and chunk.text:
                    yield chunk.text
                elif hasattr(chunk, "candidates"):
                    for c in chunk.candidates or []:
                        for part in getattr(c, "content", {}).get("parts", []):
                            if hasattr(part, "text") and part.text:
                                yield part.text
        except Exception as e:
            yield f"[Stream error: {e}]"
