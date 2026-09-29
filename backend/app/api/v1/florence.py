"""
Florence-2 Vision AI Endpoints for ContextVault.
Exposes routes under /api/florence for specialist visual extraction:
- High density OCR with 2D bounding boxes
- Detailed image and UI descriptions
- Object and UI element detection
- Feeds visual evidence into Smart Folder classification and Qwen reasoning
"""

from typing import Optional
from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse

from app.core.logging import logger
from app.services.florence_gateway_service import florence_gateway_service

router = APIRouter(prefix="/florence", tags=["Florence-2 Visual Extraction"])


@router.get("/ping", summary="Ping Florence-2 Server")
async def ping_florence():
    """Measures roundtrip latency to Florence-2 server."""
    return await florence_gateway_service.ping_server()


@router.get("/health", summary="Health check for Florence-2 Server")
async def check_florence_health():
    """Returns connectivity, active model, and GPU status."""
    return await florence_gateway_service.check_health()


@router.get("/model-info", summary="Model information for Florence-2 Server")
async def get_florence_model_info():
    """Retrieves model name, precision, tasks supported, and GPU VRAM statistics."""
    return await florence_gateway_service.get_model_info()


@router.post("/extract", summary="Extract structured visual evidence from screenshot")
async def extract_visual_evidence(
    image: Optional[UploadFile] = File(None, description="Screenshot image binary"),
    file: Optional[UploadFile] = File(None, description="Alternative field for image binary"),
):
    """
    Receives screenshot from mobile app or pipeline, streams in-memory to Florence-2 Server,
    and returns high-density visual evidence: OCR with regions, dense captions, and UI elements.
    Zero disk storage.
    """
    target = image or file
    if not target:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No image file provided in multipart request (expected 'image' or 'file')",
        )

    filename = target.filename or "screenshot.jpg"
    content_type = target.content_type or "image/jpeg"

    try:
        file_bytes = await target.read()
        if not file_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Empty image file provided.",
            )

        result = await florence_gateway_service.extract_visual_evidence(
            file_bytes=file_bytes,
            filename=filename,
            content_type=content_type,
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[FlorenceRouter] extract proxy error: {e}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "Florence Extraction Failed", "detail": str(e)},
        )
    finally:
        await target.close()
