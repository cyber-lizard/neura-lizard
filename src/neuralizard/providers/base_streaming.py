import json

class StreamingProviderMixin:
    """
    Adds a universal `.stream()` method for any provider.
    The provider must implement `_stream_request(prompt, model, **kwargs)`
    and yield either tokens or SSE JSON strings.
    """

    def stream(self, prompt: str, model: str | None = None, **kwargs):
        try:
            for chunk in self._stream_request(prompt, model=model, **kwargs):
                # Case 1: token directly
                if isinstance(chunk, str):
                    yield chunk
                    continue

                # Case 2: JSON lines from SSE stream
                if isinstance(chunk, (bytes, bytearray)):
                    line = chunk.decode("utf-8").strip()
                else:
                    line = str(chunk).strip()

                if not line or not line.startswith("data: "):
                    continue

                data = line[6:]
                if data == "[DONE]":
                    break

                try:
                    obj = json.loads(data)
                    token = (
                        obj.get("choices", [{}])[0]
                        .get("delta", {})
                        .get("content", "")
                    )
                    if token:
                        yield token
                except json.JSONDecodeError:
                    continue

        except Exception as e:
            yield f"[stream error: {e}]"
