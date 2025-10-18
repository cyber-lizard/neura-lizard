import os
import time
import re
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
    # 🔹 List available models
    # ============================================================
    def list_models(self) -> list[str]:
        """
        Return a small, relevant list of Gemini chat models:
        - Only generateContent-capable
        - Exclude embeddings/vision/audio
        - Prefer '-latest' aliases, higher versions (e.g. 2.5 > 2.0 > 1.5)
        - Prefer stable over experimental
        - Prefer pro over flash when close
        """
        try:
            raw_names: list[str] = []
            for m in genai.list_models():
                methods = getattr(m, "supported_generation_methods", []) or []
                if "generateContent" not in methods:
                    continue
                name = getattr(m, "name", "") or ""
                if name.startswith("models/"):
                    name = name.split("/", 1)[1]
                if not name:
                    continue
                lid = name.lower()
                # Exclude non-chat/irrelevant families
                banned = ("embedding", "embed", "vision", "image", "audio", "multimodal-embedding", "preview", "exp")
                if any(b in lid for b in banned):
                    continue
                raw_names.append(name)

            uniq = sorted({n for n in raw_names if isinstance(n, str) and n})

            def score(mid: str):
                lid = mid.lower()
                latest = lid.endswith("-latest")
                # Extract numeric version like gemini-2.5-...
                ver = 0.0
                mver = re.search(r"gemini-(\d+(?:\.\d+)?)", lid)
                if mver:
                    try:
                        ver = float(mver.group(1))
                    except Exception:
                        ver = 0.0
                # Prefer stable over experimental/exp
                stable = 0 if ("-exp" in lid or "experimental" in lid) else 1
                # Prefer pro over flash when comparable
                variant = 2 if "-pro" in lid else (1 if "-flash" in lid else 0)
                return (1 if latest else 0, ver, stable, variant)

            ordered = sorted(uniq, key=score, reverse=True)

            # Ensure default is present and near the top
            if getattr(self, "default_model", None):
                d = self.default_model
                if d in ordered:
                    ordered.remove(d)
                ordered.insert(0, d)

            return ordered[:25]
        except Exception:
            # Fallback to default if listing fails
            return [self.default_model] if getattr(self, "default_model", None) else []

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
