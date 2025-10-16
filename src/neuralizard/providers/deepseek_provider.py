import os
import time
import json
from typing import Any, Iterable, Generator
import httpx

from .base import LLMResult  # if you still use old base
from ._usage import usage_get
from .base_streaming import StreamingProviderMixin

# If you already migrated to base_provider/registry pattern, adapt imports:
# from .base_provider import BaseProvider, LLMResult
# from .registry import register
#
# And change class signature to (BaseProvider) and decorate with @register.
# For now we keep parity with existing OpenAIProvider pattern using StreamingProviderMixin.

DEEPSEEK_API_BASE = "https://api.deepseek.com"


class DeepSeekProvider(StreamingProviderMixin):
    """
    DeepSeek provider (chat-completions API, OpenAI-compatible style).
    - complete(): non‑streaming
    - stream(): via StreamingProviderMixin calling _stream_request()
    """
    name = "deepseek"

    def __init__(self, api_key: str | None = None, default_model: str | None = None, timeout: float = 60.0):
        self.api_key = api_key or os.getenv("DEEPSEEK_API_KEY")
        if not self.api_key:
            raise RuntimeError("DEEPSEEK_API_KEY not found (set env or add to ~/.neuralizard/.env)")
        self.default_model = default_model or "deepseek-chat"
        self.timeout = timeout
        self._client = httpx.Client(base_url=DEEPSEEK_API_BASE, timeout=timeout, headers={
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        })

    # ------------- Non‑streaming -------------
    def complete(self, prompt: str, model: str | None = None, temperature: float | None = None):
        chosen_model = model or self.default_model
        t0 = time.time()
        payload = {
            "model": chosen_model,
            "messages": [{"role": "user", "content": prompt}],
        }
        if temperature is not None:
            payload["temperature"] = temperature

        try:
            resp = self._client.post("/v1/chat/completions", json=payload)
        except Exception as e:
            raise RuntimeError(f"DeepSeek network error: {e}")

        if resp.status_code >= 400:
            raise RuntimeError(f"DeepSeek API error {resp.status_code}: {resp.text}")

        data = resp.json()
        # Response shape similar to OpenAI:
        # { choices: [ { message: { content: "..." } } ], usage: { prompt_tokens, completion_tokens, total_tokens } }
        try:
            msg = data["choices"][0]["message"]["content"]
        except Exception:
            msg = ""
        usage = data.get("usage") or {}

        return LLMResult(
            text=(msg or "").strip(),
            provider=self.name,
            model=chosen_model,
            prompt_tokens=usage_get(usage, "prompt_tokens", 0),
            response_tokens=usage_get(usage, "completion_tokens", 0),
            latency_ms=int((time.time() - t0) * 1000),
        )

    # ------------- Streaming (SSE) -------------
    def _stream_request(
        self,
        prompt: str,
        model: str | None = None,
        temperature: float | None = None,
        **kwargs: Any,
    ) -> Generator[str, None, None]:
        """
        Yields raw SSE 'data: {...}' lines or plain token strings.
        base_streaming.StreamingProviderMixin will parse 'data:' JSON lines
        and extract delta content automatically.
        """
        chosen_model = model or self.default_model
        payload = {
            "model": chosen_model,
            "messages": [{"role": "user", "content": prompt}],
            "stream": True,
        }
        if temperature is not None:
            payload["temperature"] = temperature

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
        }

        try:
            with self._client.stream("POST", "/v1/chat/completions", json=payload, headers=headers) as resp:
                if resp.status_code >= 400:
                    yield f"data: {{\"error\": \"{resp.status_code} {resp.text}\"}}"
                    return

                for line in resp.iter_lines():
                    if not line:
                        continue
                    # httpx.iter_lines() may yield bytes or str depending on version
                    if isinstance(line, (bytes, bytearray)):
                        s = line.decode("utf-8", errors="ignore")
                    else:
                        s = str(line)
                    # Pass through SSE frames; mixin will parse all 'data: ' blocks
                    if s.startswith("data: ") or "data: " in s:
                        yield s
        except Exception as e:
            yield f"data: {{\"error\": \"{e}\"}}"

    # Optional: list models endpoint (if DeepSeek exposes)
    def list_models(self) -> list[str]:
        # Could call /v1/models; keep simple for now
        return [self.default_model]

    def close(self):
        try:
            self._client.close()
        except Exception:
            pass