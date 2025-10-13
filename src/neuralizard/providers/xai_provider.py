import os, requests
from .base import LLMResult
from .base_streaming import StreamingProviderMixin

API_URL = "https://api.x.ai/v1/chat/completions"


class XAIProvider(StreamingProviderMixin):
    name = "xai"

    def __init__(self, api_key: str | None):
        self.api_key = api_key or os.getenv("XAI_API_KEY")
        if not self.api_key:
            raise RuntimeError("XAI_API_KEY missing. Add it to ~/.neuralizard/.env")

    def complete(self, prompt: str, model: str | None = None, **kwargs) -> LLMResult:
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        payload = {
            "model": model or "grok-4-latest",
            "messages": [
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": prompt},
            ],
            "stream": False,
            "temperature": kwargs.get("temperature", 0.7),
        }

        r = requests.post(API_URL, json=payload, headers=headers, timeout=60)
        r.raise_for_status()
        data = r.json()
        text = data["choices"][0]["message"]["content"]
        return LLMResult(text=text.strip(), provider=self.name, model=payload["model"])

    # 👇 This one powers .stream() in the mixin
    def _stream_request(self, prompt: str, model: str | None = None, **kwargs):
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        payload = {
            "model": model or "grok-4-latest",
            "messages": [
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": prompt},
            ],
            "stream": True,
            "temperature": kwargs.get("temperature", 0.7),
        }

        with requests.post(API_URL, json=payload, headers=headers, stream=True) as r:
            r.raise_for_status()
            for line in r.iter_lines():
                if line:
                    yield line
