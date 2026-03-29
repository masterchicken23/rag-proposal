from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from pipeline.extractor import extract_text
from pipeline.chunker import chunk_text
from pipeline.embedder import embed_documents
from pipeline.store import upsert_chunks, search, list_sources

app = FastAPI(title="Bruno RAG Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    content = await file.read()

    text = extract_text(content, file.filename)
    if not text.strip():
        raise HTTPException(status_code=422, detail="Could not extract any text from this file.")

    chunks = chunk_text(text, source=file.filename)
    embeddings = embed_documents([c["text"] for c in chunks])
    upsert_chunks(chunks, embeddings)

    return {"filename": file.filename, "chunks": len(chunks)}


class SearchRequest(BaseModel):
    query: str
    n_results: int = 8


@app.post("/search")
def do_search(body: SearchRequest):
    results = search(body.query, body.n_results)
    return {"results": results}


@app.get("/sources")
def get_sources():
    return {"sources": list_sources()}
