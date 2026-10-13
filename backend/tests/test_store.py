import pytest
from app import budget, db, store


class FakeRedis:
    def __init__(self):
        self.data = {}
        self.ttl = {}

    def get(self, key):
        return self.data.get(key)

    def set(self, key, value, ex=None, nx=False):
        if nx and key in self.data:
            return None
        self.data[key] = str(value)
        self.ttl[key] = ex
        return True

    def incr(self, key):
        self.data[key] = str(int(self.data.get(key, 0)) + 1)
        return int(self.data[key])


class BrokenRedis:
    def get(self, key):
        raise ConnectionError("down")

    set = incr = get


def test_memory_values_expire_and_counters_keep_their_first_expiry(monkeypatch):
    clock = [100.0]
    monkeypatch.setattr(store.time, "monotonic", lambda: clock[0])
    memory = store.MemoryStore()
    memory.set("a", "1", 10)
    assert memory.incr("n", 10) == 1 and memory.incr("n", 10) == 2
    clock[0] = 109.0
    assert memory.get("a") == "1" and memory.incr("n", 10) == 3
    clock[0] = 111.0
    assert memory.get("a") is None and memory.incr("n", 10) == 1


def test_redis_store_prefixes_keys_and_sets_the_expiry_once():
    client = FakeRedis()
    redis_store = store.RedisStore(client)
    assert redis_store.incr("n", 60) == 1 and redis_store.incr("n", 60) == 2
    assert client.ttl[store.PREFIX + "n"] == 60 and redis_store.get("n") == "2"


def test_a_failing_store_reads_as_empty_instead_of_raising(monkeypatch):
    monkeypatch.setattr(store, "current", store.RedisStore(BrokenRedis()))
    assert store.get_value("x") is None and store.incr("x", 5) is None and not store.healthy()


def test_an_unreachable_redis_falls_back_to_memory(monkeypatch):
    monkeypatch.setenv("REDIS_URL", "redis://127.0.0.1:1/0")
    assert store.connect().kind == "memory"


def test_daily_allowance_is_counted_in_a_shared_store_without_the_database(monkeypatch):
    monkeypatch.setattr(store, "current", store.RedisStore(FakeRedis()))
    monkeypatch.setattr(budget, "engine", lambda: pytest.fail("database was used"))
    assert [budget.allow("chat", 2) for _ in range(3)] == [True, True, False]


def test_daily_allowance_uses_the_database_when_the_shared_store_is_down(monkeypatch):
    monkeypatch.setattr(store, "current", store.RedisStore(BrokenRedis()))
    db.metadata.create_all(db.get_engine())
    assert [budget.allow("chat", 2) for _ in range(3)] == [True, True, False]
