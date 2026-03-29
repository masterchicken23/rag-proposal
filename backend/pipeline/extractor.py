import io
import json

import pdfplumber


def extract_text(content: bytes, filename: str) -> str:
    name = filename.lower()
    if name.endswith(".pdf"):
        return _extract_pdf(content)
    elif name.endswith(".json"):
        return _extract_json(content)
    else:
        return content.decode("utf-8", errors="replace")


def _extract_pdf(content: bytes) -> str:
    parts = []
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                parts.append(text)
    return "\n\n".join(parts)


def _extract_json(content: bytes) -> str:
    try:
        data = json.loads(content)
        return json.dumps(data, indent=2)
    except Exception:
        return content.decode("utf-8", errors="replace")
