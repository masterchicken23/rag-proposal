from typing import List, Dict


def chunk_text(text: str, source: str, chunk_size: int = 800, overlap: int = 100) -> List[Dict]:
    """Split text into overlapping word-based chunks."""
    words = text.split()
    chunks = []
    i = 0
    idx = 0

    while i < len(words):
        chunk_words = words[i : i + chunk_size]
        chunks.append({
            "id": f"{source}::{idx}",
            "text": " ".join(chunk_words),
            "source": source,
            "chunk_index": idx,
        })
        idx += 1
        i += chunk_size - overlap

    return chunks
