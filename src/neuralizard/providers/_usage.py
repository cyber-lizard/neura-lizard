from typing import Any

def usage_get(usage: Any, key: str, default: int = 0) -> int:
    # Works for dicts and typed SDK objects
    if usage is None:
        return default
    if isinstance(usage, dict):
        return usage.get(key, default)
    return getattr(usage, key, default)