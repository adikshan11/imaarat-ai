from __future__ import annotations

import hashlib
import json
import math
import re

from sqlalchemy import Column, String, Table, Text, select
from sqlalchemy.exc import IntegrityError

from app import llm
from app.config import GEMINI_API_KEY, GUIDELINES_MD, QDRANT_API_KEY, QDRANT_COLLECTION, QDRANT_URL
from app.db import get_engine, metadata
from app.observability import traced

_K_MIN, _K_MAX = 1, 10
loaded: dict[str, list[dict]] = {}

guideline_index = Table(
    "guideline_index",
    metadata,
    Column("version", String(16), primary_key=True),
    Column("items", Text, nullable=False),
)


def guideline_sections() -> list[dict]:
    """Split the guidelines into one retrievable chunk per section: {id, title, text}."""
    text = GUIDELINES_MD.read_text(encoding="utf-8")
    sections = []
    for match in re.finditer(r"^## (G\d+)\. (.+?)\n+(.+?)(?=\n## |\Z)", text, flags=re.MULTILINE | re.DOTALL):
        section_id, title, body = match.groups()
        sections.append({"id": section_id, "title": title.strip(), "text": " ".join(body.split())})
    return sections


def corpus_hash(sections: list[dict]) -> str:
    return hashlib.sha256(json.dumps(sections, sort_keys=True).encode()).hexdigest()[:16]


def section_document(section: dict) -> str:
    return f"{section['title']}. {section['text']}"


def qdrant_search(query_vector: list[float], k: int) -> list[dict]:
    """Search Qdrant Cloud, (re)indexing the guidelines when the collection is missing or stale."""
    from qdrant_client import QdrantClient
    from qdrant_client.models import Distance, PointStruct, VectorParams

    client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY, timeout=30)
    sections = guideline_sections()
    version = corpus_hash(sections)
    current = client.collection_exists(QDRANT_COLLECTION) and client.scroll(QDRANT_COLLECTION, limit=1, with_payload=True)[0]
    if not current or current[0].payload.get("version") != version:
        vectors = llm.embed([section_document(section) for section in sections], "RETRIEVAL_DOCUMENT")
        if client.collection_exists(QDRANT_COLLECTION):
            client.delete_collection(QDRANT_COLLECTION)
        client.create_collection(QDRANT_COLLECTION, vectors_config=VectorParams(size=len(vectors[0]), distance=Distance.COSINE))
        client.upsert(
            QDRANT_COLLECTION,
            points=[PointStruct(id=i, vector=vector, payload={**section, "version": version}) for i, (section, vector) in enumerate(zip(sections, vectors))],
        )
        print(f"[rag_lookup] indexed {len(sections)} guideline sections into Qdrant (version {version})")
    hits = client.query_points(QDRANT_COLLECTION, query=query_vector, limit=k, with_payload=True).points
    return [{"id": hit.payload["id"], "title": hit.payload["title"], "text": hit.payload["text"], "score": round(hit.score, 4)} for hit in hits]


def cosine(left: list[float], right: list[float]) -> float:
    dot = sum(a * b for a, b in zip(left, right))
    norms = math.sqrt(sum(a * a for a in left)) * math.sqrt(sum(b * b for b in right))
    return dot / norms if norms else 0.0


def index_items() -> list[dict]:
    """Guideline vectors embedded once per corpus version and kept in the app database, so cold starts only read them."""
    sections = guideline_sections()
    version = corpus_hash(sections)
    if version in loaded:
        return loaded[version]
    engine = get_engine()
    metadata.create_all(engine, tables=[guideline_index])
    with engine.connect() as connection:
        stored = connection.execute(select(guideline_index.c.items).where(guideline_index.c.version == version)).scalar()
    if stored:
        items = json.loads(stored)
    else:
        vectors = llm.embed([section_document(section) for section in sections], "RETRIEVAL_DOCUMENT")
        items = [{**section, "vector": vector} for section, vector in zip(sections, vectors)]
        try:
            with engine.begin() as connection:
                connection.execute(guideline_index.insert().values(version=version, items=json.dumps(items)))
        except IntegrityError:
            print(f"[rag_lookup] index version {version} was stored by another instance first")
        print(f"[rag_lookup] embedded {len(sections)} guideline sections (version {version})")
    loaded[version] = items
    return items


def local_search(query_vector: list[float], k: int) -> list[dict]:
    """Search the guideline vectors kept in the app database when Qdrant is not configured."""
    ranked = sorted(index_items(), key=lambda item: cosine(query_vector, item["vector"]), reverse=True)
    return [{"id": item["id"], "title": item["title"], "text": item["text"], "score": round(cosine(query_vector, item["vector"]), 4)} for item in ranked[:k]]


@traced("rag_retrieval", as_type="retriever")
def retrieve(query: str, k: int = 4, ai_note: str | None = None) -> list[dict]:
    """Return the guideline sections closest to the query, best first.

    Returns [] with a logged reason when retrieval is unavailable.
    """
    k = max(_K_MIN, min(_K_MAX, k))
    if not GEMINI_API_KEY or ai_note:
        print(f"[rag_lookup] status=unavailable reason={ai_note or 'missing_api_key'}")
        return []
    try:
        query_vector = llm.embed([query], "RETRIEVAL_QUERY")[0]
        hits = qdrant_search(query_vector, k) if QDRANT_URL else local_search(query_vector, k)
        print(f"[rag_lookup] status=available store={'qdrant' if QDRANT_URL else 'local'} hits={[hit['id'] for hit in hits]}")
        return hits
    except Exception as e:
        print(f"[rag_lookup] status=unavailable reason=retrieval_failed error={type(e).__name__}: {str(e)[:120]}")
        return []


def format_hit(hit: dict) -> str:
    return f"[{hit['id']}] {hit['title']}: {hit['text']}"
