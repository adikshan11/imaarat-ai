"""Shared key-value store for caches, pauses and daily counters: in memory by default, Redis when REDIS_URL is set."""

from __future__ import annotations

import json
import os
import threading
import time
from collections import OrderedDict
from typing import Any

PREFIX = "imaarat:"
MEMORY_LIMIT = 512


class MemoryStore:
    """One process only: fine for a laptop or a single container, not shared between serverless instances."""

    kind = "memory"
    shared = False

    def __init__(self) -> None:
        self.items: OrderedDict[str, tuple[float, str]] = OrderedDict()
        self.lock = threading.Lock()

    def live(self, key: str) -> tuple[float, str] | None:
        entry = self.items.get(key)
        if entry is not None and entry[0] < time.monotonic():
            del self.items[key]
            return None
        return entry

    def get(self, key: str) -> str | None:
        with self.lock:
            entry = self.live(key)
            if entry is None:
                return None
            self.items.move_to_end(key)
            return entry[1]

    def set(self, key: str, value: str, ttl: int) -> None:
        with self.lock:
            self.items[key] = (time.monotonic() + ttl, value)
            self.items.move_to_end(key)
            while len(self.items) > MEMORY_LIMIT:
                self.items.popitem(last=False)

    def incr(self, key: str, ttl: int) -> int:
        with self.lock:
            entry = self.live(key)
            count = int(entry[1]) + 1 if entry else 1
            self.items[key] = (entry[0] if entry else time.monotonic() + ttl, str(count))
            return count


class RedisStore:
    """Shared by every instance that points at the same Redis."""

    kind = "redis"
    shared = True

    def __init__(self, client: Any) -> None:
        self.client = client

    def get(self, key: str) -> str | None:
        return self.client.get(PREFIX + key)

    def set(self, key: str, value: str, ttl: int) -> None:
        self.client.set(PREFIX + key, value, ex=ttl)

    def incr(self, key: str, ttl: int) -> int:
        name = PREFIX + key
        self.client.set(name, 0, ex=ttl, nx=True)
        return int(self.client.incr(name))


def connect() -> MemoryStore | RedisStore:
    url = os.getenv("REDIS_URL", "").strip()
    if not url:
        return MemoryStore()
    try:
        import redis

        client = redis.Redis.from_url(url, decode_responses=True, socket_timeout=1.0, socket_connect_timeout=1.0)
        client.ping()
        return RedisStore(client)
    except Exception as error:
        print(f"[store] status=memory reason={type(error).__name__}")
        return MemoryStore()


current: MemoryStore | RedisStore | None = None
guard = threading.Lock()


def backend() -> MemoryStore | RedisStore:
    global current
    with guard:
        if current is None:
            current = connect()
        return current


def kind() -> str:
    return backend().kind


def shared() -> bool:
    return backend().shared


def get_value(key: str) -> str | None:
    """A stored text value, or None when it is missing or the store is down."""
    try:
        return backend().get(key)
    except Exception as error:
        print(f"[store] status=get_failed reason={type(error).__name__}")
        return None


def set_value(key: str, value: str, ttl: int) -> None:
    try:
        backend().set(key, value, ttl)
    except Exception as error:
        print(f"[store] status=set_failed reason={type(error).__name__}")


def incr(key: str, ttl: int) -> int | None:
    """Add one to a counter that expires after ttl seconds; None when the store is down."""
    try:
        return backend().incr(key, ttl)
    except Exception as error:
        print(f"[store] status=incr_failed reason={type(error).__name__}")
        return None


def get_json(key: str) -> Any:
    value = get_value(key)
    return json.loads(value) if value is not None else None


def set_json(key: str, value: Any, ttl: int) -> None:
    set_value(key, json.dumps(value, separators=(",", ":")), ttl)


def healthy() -> bool:
    """True when a value written to the store can be read back."""
    set_value("health", "ok", 30)
    return get_value("health") == "ok"
