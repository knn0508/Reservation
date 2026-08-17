from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.config import settings

router = APIRouter(prefix="/api/ai", tags=["ai"])


class NotesExtractRequest(BaseModel):
    text: str


class NotesExtractResponse(BaseModel):
    allergies: list[str]
    dietary_restrictions: list[str]
    occasion: str | None
    seating_preference: str | None


@router.post("/extract-notes", response_model=NotesExtractResponse)
async def extract_notes(payload: NotesExtractRequest):
    """Turns a guest's free-text special request into structured booking fields via Gemini."""
    if not settings.gemini_api_key:
        raise HTTPException(status_code=503, detail="AI extraction is not configured")

    import google.generativeai as genai

    genai.configure(api_key=settings.gemini_api_key)
    model = genai.GenerativeModel(
        "gemini-1.5-flash",
        generation_config={"response_mime_type": "application/json"},
    )
    prompt = (
        "Extract structured booking notes from this guest request. "
        "Return JSON with keys: allergies (string list), dietary_restrictions (string list), "
        "occasion (string or null), seating_preference (string or null).\n\n"
        f"Guest request: {payload.text}"
    )
    response = model.generate_content(prompt)

    import json

    data = json.loads(response.text)
    return NotesExtractResponse(**data)
