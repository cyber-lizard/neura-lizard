import os
from typing import Any, Generator, Optional
from perplexity import Perplexity
from .base_streaming import StreamingProviderMixin


class PerplexityProvider(StreamingProviderMixin):
    """
    Perplexity via official SDK (OpenAI-compatible).
    Uses PERPLEXITY_API_KEY from env by default.
    """

    ALLOWED_MODELS = {
        "sonar-small-online",
        "sonar-medium-online",
        "sonar-small-chat",
        "sonar-medium-chat",
        "sonar-pro",
    }

    def __init__(self, api_key: Optional[str] = None, default_model: Optional[str] = None, timeout: float = 60.0):
        self.api_key = api_key or os.getenv("PERPLEXITY_API_KEY")
        # default to sonar-pro (adjust if you prefer an online/chat variant)
        self.default_model = (default_model or "sonar-pro")
        self.timeout = timeout
        # SDK uses env if api_key=None
        self.client = Perplexity(api_key=self.api_key) if self.api_key else Perplexity()

    def _normalize_model(self, model: Optional[str]) -> str:
        m = (model or self.default_model or "").strip()
        return m if m in self.ALLOWED_MODELS else self.default_model

    def _stream_request(
        self,
        prompt: str,
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs: Any,
    ) -> Generator[str, None, None]:
        chosen_model = self._normalize_model(model)
        T = None if temperature is None else max(0.0, min(2.0, float(temperature)))

        stream = self.client.chat.completions.create(
            model=chosen_model,
            messages=[{"role": "user", "content": prompt}],
            temperature=T,
            max_tokens=max_tokens,
            stream=True,
        )

        # SDK yields chunk objects; extract delta content
        try:
            for chunk in stream:
                try:
                    choice0 = (chunk.choices or [None])[0]
                    delta = getattr(choice0, "delta", None)
                    token = ""
                    if delta is not None:
                        token = getattr(delta, "content", None) or getattr(delta, "text", None) or ""
                    else:
                        # some SDK versions expose chunk.choices[0].message.content
                        msg = getattr(choice0, "message", None)
                        if msg is not None:
                            token = getattr(msg, "content", "") or ""
                    if token:
                        yield token
                except Exception:
                    continue
        except Exception as e:
            yield f"data: {{\"error\":\"{e}\"}}"

    def complete(
        self,
        prompt: str,
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = 1024,
        **kwargs: Any,
    ):
        # return a result with attributes .text/.model/.provider
        class SimpleResult:
            def __init__(self, text: str, model: str, usage: Any = None, raw: Any = None):
                self.text = text
                self.model = model
                self.provider = "perplexity"
                self.usage = usage or {}
                self.raw = raw

        chosen_model = self._normalize_model(model)
        T = None if temperature is None else max(0.0, min(2.0, float(temperature)))

        try:
            completion = self.client.chat.completions.create(
                model=chosen_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=T,
                max_tokens=max_tokens,
                stream=False,
            )
            choice0 = (completion.choices or [None])[0]
            msg = getattr(choice0, "message", None)
            text = (getattr(msg, "content", None) or getattr(choice0, "text", None) or "") or ""
            return SimpleResult(
                text=text,
                model=getattr(completion, "model", chosen_model),
                usage=getattr(completion, "usage", {}) or {},
                raw=completion,
            )
        except Exception as e:
            return SimpleResult(text="", model=chosen_model, usage={}, raw={"error": str(e)})