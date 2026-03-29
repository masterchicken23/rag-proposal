import os
from typing import List

from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

_client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
_MODEL = "gemini-embedding-001"


def embed_documents(texts: List[str]) -> List[List[float]]:
    return [
        _client.models.embed_content(
            model=_MODEL,
            contents=t,
            config=types.EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT"),
        ).embeddings[0].values
        for t in texts
    ]


def embed_query(text: str) -> List[float]:
    return _client.models.embed_content(
        model=_MODEL,
        contents=text,
        config=types.EmbedContentConfig(task_type="RETRIEVAL_QUERY"),
    ).embeddings[0].values
