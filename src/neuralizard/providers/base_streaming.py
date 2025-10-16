import json
import re

class StreamingProviderMixin:
    """
    Adds a universal `.stream()` method for any provider.
    The provider must implement `_stream_request(prompt, model, **kwargs)`
    and yield either:
      - plain token strings, or
      - SSE chunks like 'data: {...}' (bytes or str). Multiple 'data: ' blocks
        may come concatenated in a single chunk — we split and parse all.
    """

    def stream(self, prompt: str, model: str | None = None, **kwargs):
        try:
            for chunk in self._stream_request(prompt, model=model, **kwargs):
                # Normalize to text
                if isinstance(chunk, (bytes, bytearray)):
                    text = chunk.decode("utf-8", errors="ignore")
                else:
                    text = str(chunk)

                if not text:
                    continue

                # If chunk contains SSE frames, split and parse them
                if "data: " in text:
                    # Split while keeping only the payload parts after 'data: '
                    parts = text.split("data: ")
                    for part in parts:
                        part = part.strip()
                        if not part:
                            continue
                        if part == "[DONE]":
                            return
                        # Some servers concatenate without newline; each 'part' should be a JSON object
                        try:
                            obj = json.loads(part)
                        except json.JSONDecodeError:
                            # Not JSON; skip quietly
                            continue

                        # OpenAI/DeepSeek delta content shape
                        delta = (
                            (obj.get("choices") or [{}])[0]
                            .get("delta", {})
                        )
                        token = delta.get("content") or ""
                        if token:
                            yield token
                    continue

                # Otherwise treat as already-parsed token text
                yield text
        except Exception as e:
            yield f"[stream error: {e}]"
