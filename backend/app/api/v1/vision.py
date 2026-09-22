"""
Vision API Gateway Endpoints for ContextVault.
Exposes unauthenticated LAN proxy routes under /api/vision for the mobile app,
forwarding requests to the standalone Local Vision AI Server on RTX 4050.
"""

from typing import List
from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse
import httpx

from app.core.logging import logger
from app.services.vision_gateway_service import vision_gateway_service

router = APIRouter(prefix="/vision", tags=["Vision Gateway"])


@router.get(
    "/health",
    summary="Health check proxy for Local Vision AI Server",
)
async def check_vision_health():
    """Returns connectivity and model loading status from the Local Vision Server."""
    return await vision_gateway_service.check_health()


@router.get(
    "/model-info",
    summary="Model information proxy for Local Vision AI Server",
)
async def get_vision_model_info():
    """Retrieves active model name, precision, and GPU VRAM statistics."""
    try:
        return await vision_gateway_service.get_model_info()
    except httpx.ConnectError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Vision Server Offline",
        )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Vision Server Timeout",
        )
    except Exception as e:
        logger.error(f"[VisionRouter] model-info proxy error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Vision Server Unavailable: {str(e)}",
        )


@router.post(
    "/analyze",
    summary="Proxy single screenshot analysis to Local Vision AI Server",
)
async def analyze_screenshot(
    image: UploadFile = File(..., description="Preprocessed screenshot image binary"),
):
    """
    Receives preprocessed screenshot from mobile app, streams in-memory to Local Vision Server,
    and returns structured scene metadata (category, confidence, summary, tags, entities).
    Images are never saved to disk or SQL Server.
    """
    filename = image.filename or "screenshot.jpg"
    content_type = image.content_type or "image/jpeg"

    try:
        file_bytes = await image.read()
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

    except httpx.ConnectError:
        logger.error("[VisionRouter] Connection refused to Local Vision Server.")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"error": "Vision Server Offline", "detail": "Cannot reach Vision Server on LAN."},
        )
    except httpx.TimeoutException:
        logger.error("[VisionRouter] Vision inference request timed out.")
        return JSONResponse(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            content={"error": "Vision Server Timeout", "detail": "Vision inference exceeded timeout limit."},
        )
    except httpx.HTTPStatusError as e:
        logger.error(f"[VisionRouter] Vision Server returned error status {e.response.status_code}")
        return JSONResponse(
            status_code=e.response.status_code,
            content={"error": "Vision Analysis Failed", "detail": e.response.text},
        )
    except Exception as e:
        logger.error(f"[VisionRouter] analyze proxy error: {e}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "Vision Analysis Failed", "detail": str(e)},
        )
    finally:
        await image.close()


@router.post(
    "/batch",
    summary="Proxy batch screenshot analysis to Local Vision AI Server",
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
            files_data.append((img.name or "images", data, img.filename or "screenshot.jpg"))

        result = await vision_gateway_service.analyze_batch(files_data)
        return result
    except httpx.ConnectError:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"error": "Vision Server Offline", "detail": "Cannot reach Vision Server on LAN."},
        )
    except httpx.TimeoutException:
        return JSONResponse(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            content={"error": "Vision Server Timeout", "detail": "Batch inference timed out."},
        )
    except Exception as e:
        logger.error(f"[VisionRouter] batch proxy error: {e}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "Vision Analysis Failed", "detail": str(e)},
        )
    finally:
        for img in images:
            await img.close()
