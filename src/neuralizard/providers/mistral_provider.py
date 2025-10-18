import os
import time
import re
from mistralai import Mistral
from .base import LLMResult
from .base_streaming import StreamingProviderMixin


class MistralProvider(StreamingProviderMixin):
    """
    Mistral provider (single + streaming).
    """

    name = "mistral"

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or os.getenv("MISTRAL_API_KEY")
        if not self.api_key:
            raise RuntimeError("MISTRAL_API_KEY missing. Add it to ~/.neuralizard/.env")
        self.client = Mistral(api_key=self.api_key)
        self.default_model = "mistral-large-latest"

    # -------- Non‑streaming --------
    def complete(self, prompt: str, model: str | None = None, **kwargs) -> LLMResult:
        chosen_model = model or self.default_model
        t0 = time.time()
        try:
            resp = self.client.chat.complete(
                model=chosen_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=kwargs.get("temperature", 0.7),
                max_tokens=kwargs.get("max_tokens", 1024),
            )
        except Exception as e:
            raise RuntimeError(f"Mistral API error: {e}")

        text = resp.choices[0].message.content
        usage = getattr(resp, "usage", {}) or {}
        return LLMResult(
            text=text.strip(),
            provider=self.name,
            model=chosen_model,
            prompt_tokens=usage.get("prompt_tokens", 0),
            response_tokens=usage.get("completion_tokens", 0),
            latency_ms=int((time.time() - t0) * 1000),
        )

    # -------- Streaming (used by mixin) --------
    def _stream_request(self, prompt: str, model: str | None = None, **kwargs):
        """
        Yield incremental text chunks. Defensive against SDK variations
        (some events lack .type; use .event_type or class name).
        """
        chosen_model = model or self.default_model
        debug = kwargs.get("debug", False)

        try:
            # Some SDKs: self.client.chat.stream(...)
            with self.client.chat.stream(
                model=chosen_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=kwargs.get("temperature", 0.7),
                max_tokens=kwargs.get("max_tokens", 1024),
            ) as stream:
                for event in stream:
                    etype = (
                        getattr(event, "type", None)
                        or getattr(event, "event_type", None)
                        or getattr(event, "event", None)
                        or event.__class__.__name__
                    )

                    if debug:
                        yield f"[DEBUG {etype}]"

                    # Known delta patterns
                    # Pattern A: event.data.delta.content (list or str)
                    delta_obj = getattr(getattr(event, "data", None), "delta", None)
                    if delta_obj:
                        content = getattr(delta_obj, "content", None)
                        if isinstance(content, str) and content:
                            yield content
                            continue
                        if isinstance(content, list):
                            for part in content:
                                if isinstance(part, str) and part:
                                    yield part
                            continue

                    # Pattern B: direct message chunk (fallback)
                    if hasattr(event, "data") and hasattr(event.data, "choices"):
                        try:
                            choices = event.data.choices
                            if choices:
                                piece = getattr(choices[0].delta, "content", None)
                                if piece:
                                    if isinstance(piece, str):
                                        yield piece
                                    elif isinstance(piece, list):
                                        for p in piece:
                                            if isinstance(p, str):
                                                yield p
                        except Exception:
                            pass

                    # Completion / stop signals
                    if any(k in str(etype).lower() for k in ("completed", "stop", "end")):
                        break

                    # Errors
                    if "error" in str(etype).lower():
                        err = getattr(event, "error", None) or getattr(getattr(event, "data", None), "error", None)
                        yield f"[ERROR: {err}]"
                        break

        except Exception as e:
            yield f"[Stream error: {e}]"

    # -------- List models --------
    def list_models(self) -> list[str]:
        """
        Return a small, relevant list of Mistral chat models:
        - Exclude embeddings/vision/audio
        - Optionally exclude code models (Codestral) unless MISTRAL_INCLUDE_CODE=1
        - Prefer '-latest' aliases; otherwise keep only the newest snapshot per family
        """
        try:
            resp = self.client.models.list()
            items = getattr(resp, "data", resp) or []

            include_code = (os.getenv("MISTRAL_INCLUDE_CODE", "0") or "").strip().lower() in ("1", "true", "yes", "on")

            # Gather candidate ids
            names: list[str] = []
            for m in items:
                mid = getattr(m, "id", None)
                if not isinstance(mid, str) or not mid:
                    continue
                lid = mid.lower()
                # Exclude non-chat/irrelevant families
                banned = ("embed", "embedding", "image", "vision", "pixtral", "audio", "speech")
                if any(b in lid for b in banned):
                    continue
                if ("codestral" in lid) and not include_code:
                    continue
                names.append(mid)

            names = sorted({n for n in names if isinstance(n, str) and n})

            # Group by family base (strip -latest or -NNNN snapshot)
            def base_of(s: str) -> str:
                return re.sub(r"-(latest|\d{4})$", "", s)

            def snapshot_version(s: str) -> int:
                m = re.search(r"-(\d{4})$", s)
                return int(m.group(1)) if m else -1

            groups: dict[str, list[str]] = {}
            for n in names:
                b = base_of(n)
                groups.setdefault(b, []).append(n)

            # Pick one per family: latest if present else highest snapshot else the plain id
            picked: list[str] = []
            for b, ids in groups.items():
                latest = [x for x in ids if x.endswith("-latest")]
                if latest:
                    picked.append(latest[0])
                else:
                    # choose highest snapshot number if any
                    with_versions = [x for x in ids if re.search(r"-(\d{4})$", x)]
                    if with_versions:
                        picked.append(sorted(with_versions, key=snapshot_version, reverse=True)[0])
                    else:
                        picked.append(sorted(ids)[0])

            # Rank families: large > nemo/open-mixtral > small > others
            def family_rank(s: str) -> int:
                l = s.lower()
                if "large" in l:
                    return 4
                if "nemo" in l or "mixtral" in l:
                    return 3
                if "small" in l:
                    return 2
                return 1

            ordered = sorted(
                picked,
                key=lambda s: (
                    1 if s.endswith("-latest") else 0,
                    family_rank(s),
                    snapshot_version(s),
                ),
                reverse=True,
            )

            # Ensure default present at the top
            if getattr(self, "default_model", None):
                d = self.default_model
                if d in ordered:
                    ordered.remove(d)
                ordered.insert(0, d)

            return ordered[:10]
        except Exception:
            return [self.default_model] if getattr(self, "default_model", None) else []