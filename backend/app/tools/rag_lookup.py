from __future__ import annotations

import json
import math

from google import genai

from app.config import (
    GEMINI_API_KEY,
    GEMINI_EMBEDDING_MODEL_NAME,
    GUIDELINES_PDF,
    QDRANT_API_KEY,
    QDRANT_COLLECTION,
    QDRANT_URL,
    VECTORSTORE_DIR,
)

_K_MIN, _K_MAX = 1, 10
INDEX_PATH = VECTORSTORE_DIR / "underwriting_guidelines.json"


def chunk_text(text: str, size: int = 420) -> list[str]:
    chunks, current = [], []
    for word in text.split():
        current.append(word)
        if len(" ".join(current)) >= size:
            chunks.append(" ".join(current))
            current = []
    if current:
        chunks.append(" ".join(current))
    return chunks


def embed(genai_client, text: str, task_type: str) -> list[float]:
    response = genai_client.models.embed_content(
        model=GEMINI_EMBEDDING_MODEL_NAME,
        contents=[text],
        config={"task_type": task_type},
    )
    return list(response.embeddings[0].values)


def guideline_chunks() -> list[str]:
    from pypdf import PdfReader

    return chunk_text("\n".join(page.extract_text() or "" for page in PdfReader(str(GUIDELINES_PDF)).pages))


def qdrant_search(genai_client, query_vector: list[float], k: int) -> list[str]:
    """Search the Qdrant Cloud collection, embedding the guidelines PDF into it on first use."""
    from qdrant_client import QdrantClient
    from qdrant_client.models import Distance, PointStruct, VectorParams

    client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY, timeout=30)
    if not client.collection_exists(QDRANT_COLLECTION) or client.count(QDRANT_COLLECTION).count == 0:
        chunks = guideline_chunks()
        vectors = [embed(genai_client, chunk, "RETRIEVAL_DOCUMENT") for chunk in chunks]
        if not client.collection_exists(QDRANT_COLLECTION):
            client.create_collection(QDRANT_COLLECTION, vectors_config=VectorParams(size=len(vectors[0]), distance=Distance.COSINE))
        client.upsert(
            QDRANT_COLLECTION,
            points=[PointStruct(id=i, vector=vector, payload={"chunk": chunk}) for i, (chunk, vector) in enumerate(zip(chunks, vectors))],
        )
        print(f"[rag_lookup] indexed {len(chunks)} guideline chunks into Qdrant")
    hits = client.query_points(QDRANT_COLLECTION, query=query_vector, limit=k, with_payload=True).points
    return [str(hit.payload["chunk"]) for hit in hits]


def cosine(left: list[float], right: list[float]) -> float:
    dot = sum(a * b for a, b in zip(left, right))
    norms = math.sqrt(sum(a * a for a in left)) * math.sqrt(sum(b * b for b in right))
    return dot / norms if norms else 0.0


def local_search(genai_client, query_vector: list[float], k: int) -> list[str]:
    """Fallback when Qdrant is not configured: a JSON vector index on local disk."""
    if INDEX_PATH.exists():
        index = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
    else:
        index = [{"chunk": chunk, "vector": embed(genai_client, chunk, "RETRIEVAL_DOCUMENT")} for chunk in guideline_chunks()]
        INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
        INDEX_PATH.write_text(json.dumps(index), encoding="utf-8")
    ranked = sorted(index, key=lambda item: cosine(query_vector, item["vector"]), reverse=True)
    return [item["chunk"] for item in ranked[:k]]


def rag_lookup(query: str, k: int = 4) -> list[str]:
    """Return the underwriting guideline chunks closest to the query.

    Returns retrieved chunks on success, [] when no relevant evidence is found,
    or [] with a logged failure reason when retrieval is unavailable.
    """
    k = max(_K_MIN, min(_K_MAX, k))

    if not GEMINI_API_KEY:
        print("[rag_lookup] status=unavailable reason=missing_api_key")
        return []

    try:
        genai_client = genai.Client(api_key=GEMINI_API_KEY)
        query_vector = embed(genai_client, query, "RETRIEVAL_QUERY")
        store = "qdrant" if QDRANT_URL else "local"
        chunks = qdrant_search(genai_client, query_vector, k) if QDRANT_URL else local_search(genai_client, query_vector, k)
        print(f"[rag_lookup] status=available store={store} chunks={len(chunks)}")
        return chunks
    except Exception as e:
        print(f"[rag_lookup] status=unavailable reason=retrieval_failed error={type(e).__name__}: {str(e)[:80]}")
        return []
