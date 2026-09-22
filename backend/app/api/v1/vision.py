"""
Vision API Gateway Endpoints for ContextVault (Sprint P2-C).
Exposes LAN proxy routes under /api/vision for the mobile app,
forwarding requests to the standalone Local Vision AI Server on RTX 4050
and returning standardized production-ready metadata schemas.
"""

from typing import List, Optional
from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse

from app.core.logging import logger
from app.services.vision_gateway_service import vision_gateway_service

router = APIRouter(prefix="/vision", tags=["Vision AI Gateway"])


@router.get(
    "/ping",
    summary="Ping Local Vision AI Server",
)
async def ping_vision():
    """Measures roundtrip latency and connectivity to Local Vision AI Server."""
    return await vision_gateway_service.ping_server()


@router.get(
    "/health",
    summary="Health check proxy for Local Vision AI Server",
)
async def check_vision_health():
    """Returns connectivity, active model, and GPU status."""
    return await vision_gateway_service.check_health()


@router.get(
    "/model-info",
    summary="Model information proxy for Local Vision AI Server",
)
async def get_vision_model_info():
    """Retrieves active model name, precision, quantization, and GPU VRAM statistics."""
    return await vision_gateway_service.get_model_info()


@router.post(
    "/analyze",
    summary="Analyze single screenshot image using Vision AI",
)
async def analyze_screenshot(
    image: Optional[UploadFile] = File(None, description="Preprocessed screenshot image binary"),
    file: Optional[UploadFile] = File(None, description="Alternative field for image binary"),
):
    """
    Receives preprocessed screenshot from mobile app, streams in-memory to Local Vision Server,
    normalizes the output, and returns standardized metadata including OCR text, merchant,
    amount, currency, dates, entities, tags, summary, and folder hierarchy.
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

        result = await vision_gateway_service.analyze_image(
            file_bytes=file_bytes,
            filename=filename,
            content_type=content_type,
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[VisionRouter] analyze proxy error: {e}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "Vision Analysis Failed", "detail": str(e)},
        )
    finally:
        await target.close()


@router.post(
    "/batch",
    summary="Batch screenshot analysis using Vision AI",
)
async def analyze_batch(
    images: List[UploadFile] = File(..., description="List of preprocessed screenshots"),
):
    """Proxies sequential batch analysis of multiple screenshots."""
    if not images:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No images provided for batch analysis.",
        )

    files_data = []
    try:
        for img in images:
            data = await img.read()
            fname = img.filename or "screenshot.jpg"
            files_data.append(("images", data, fname))

        return await vision_gateway_service.analyze_batch(files_data)
    except Exception as e:
        logger.error(f"[VisionRouter] batch proxy error: {e}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "Vision Batch Failed", "detail": str(e)},
        )
    finally:
        for img in images:
            await img.close()
