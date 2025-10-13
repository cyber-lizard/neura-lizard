# src/neuralizard/providers/cohere_provider.py
import time, os, requests
from .base import LLMResult

API_URL = "https://api.cohere.ai/v1/chat"

class CohereProvider:
    name = "cohere"

    def __init__(self, api_key: str | None):
        self.api_key = api_key or os.getenv("COHERE_API_KEY")

    def complete(self, prompt: str, model: str | None = None, **kwargs) -> LLMResult:
        if not self.api_key:
            raise RuntimeError("COHERE_API_KEY missing")

        headers = {"Authorization": f"Bearer {self.api_key}"} 
        payload = {
            "model": model or "command-r-plus",
            "message": prompt,
        }

        t0 = time.time()
        r = requests.post(API_URL, headers=headers, json=payload, timeout=60)
        r.raise_for_status()
        data = r.json()

        text = data["text"]

        return LLMResult(
            text=text.strip(),
            provider=self.name,
            model=model or "command-r-plus",
            latency_ms=int((time.time() - t0) * 1000),
        )
