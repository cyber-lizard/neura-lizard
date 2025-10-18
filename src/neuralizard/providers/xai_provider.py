import os, requests
import re
from .base import LLMResult
from .base_streaming import StreamingProviderMixin

API_URL = "https://api.x.ai/v1/chat/completions"


class XAIProvider(StreamingProviderMixin):
    name = "xai"

    def __init__(self, api_key: str | None):
        self.api_key = api_key or os.getenv("XAI_API_KEY")
        if not self.api_key:
            raise RuntimeError("XAI_API_KEY missing. Add it to ~/.neuralizard/.env")
        self.default_model = "grok-4-latest"

    def complete(self, prompt: str, model: str | None = None, **kwargs) -> LLMResult:
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        payload = {
            "model": model or self.default_model,
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

    def list_models(self) -> list[str]:
        """
        Return a small, relevant list of Grok chat models:
        - Prefer '-latest' aliases
        - Prefer higher versions (e.g. 2.5 > 2.0 > 1.x)
        - Prefer non-mini over mini
        - Exclude preview/experimental and snapshot variants (-YYYY[-MM[-DD]] or -NNNN)
        """
        try:
            r = requests.get(
                "https://api.x.ai/v1/models",
                headers={"Authorization": f"Bearer {self.api_key}", "Accept": "application/json"},
                timeout=30,
            )
            if r.status_code >= 400:
                return [self.default_model]

            payload = r.json() or {}
            items = payload.get("data") or []
            raw = [it.get("id") for it in items if isinstance(it, dict) and it.get("id")]
            names = sorted({n for n in raw if isinstance(n, str) and n})

            def is_chat(mid: str) -> bool:
                lid = mid.lower()
                banned = ("embedding", "embed", "vision", "image", "audio", "whisper", "tts", "moderation")
                if any(b in lid for b in banned):
                    return False
                if any(tag in lid for tag in ("preview", "experimental", "exp", "alpha", "beta")):
                    return False
                # drop snapshots: -YYYY[-MM[-DD]] or numeric -NNNN
                if re.search(r"-(?:20\d{2}(?:-\d{2}){0,2}|\d{4})$", lid):
                    return False
                return lid.startswith("grok-")

            candidates = [n for n in names if is_chat(n)]

            def score(mid: str):
                lid = mid.lower()
                latest = lid.endswith("-latest")
                ver = 0.0
                mver = re.search(r"grok-(\d+(?:\.\d+)?)", lid)
                if mver:
                    try:
                        ver = float(mver.group(1))
                    except Exception:
                        ver = 0.0
                is_mini = "-mini" in lid
                return (1 if latest else 0, ver, 0 if is_mini else 1)

            ordered = sorted(candidates, key=score, reverse=True)

            d = getattr(self, "default_model", None)
            if d:
                if d in ordered:
                    ordered.remove(d)
                ordered.insert(0, d)

            return ordered[:10] if ordered else ([d] if d else [])
        except Exception:
            return [self.default_model] if getattr(self, "default_model", None) else []

    # 👇 This one powers .stream() in the mixin
    def _stream_request(self, prompt: str, model: str | None = None, **kwargs):
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        payload = {
            "model": model or self.default_model,
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
