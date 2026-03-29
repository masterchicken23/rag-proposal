from typing import List, Dict

import chromadb

from .embedder import embed_query

_client = chromadb.PersistentClient(path="./chroma_db")
_collection = _client.get_or_create_collection("documents", metadata={"hnsw:space": "cosine"})


def upsert_chunks(chunks: List[Dict], embeddings: List[List[float]]) -> None:
    """Insert or replace all chunks for a given source."""
    source = chunks[0]["source"] if chunks else None
    if source:
        existing = _collection.get(where={"source": source})
        if existing["ids"]:
            _collection.delete(ids=existing["ids"])

    _collection.add(
        ids=[c["id"] for c in chunks],
        embeddings=embeddings,
        documents=[c["text"] for c in chunks],
        metadatas=[{"source": c["source"], "chunk_index": c["chunk_index"]} for c in chunks],
    )


def search(query: str, n_results: int = 5) -> List[Dict]:
    total = _collection.count()
    if total == 0:
        return []

    results = _collection.query(
        query_embeddings=[embed_query(query)],
        n_results=min(n_results, total),
    )

    return [
        {
            "text": doc,
            "source": meta["source"],
            "score": round(1 - dist, 4),
        }
        for doc, meta, dist in zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0],
        )
    ]


def list_sources() -> List[str]:
    result = _collection.get()
    return list({m["source"] for m in result["metadatas"]}) if result["metadatas"] else []
