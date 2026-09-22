"""
Vision Gateway Service for ContextVault.
Proxies Vision AI requests from mobile clients directly to the standalone
Local Vision Server (Qwen2.5-VL-3B on RTX 4050) over LAN.

STRICT PRIVACY / STREAMING RULES:
- Never save image binaries to disk.
- Never write image bytes to SQL Server.
- Never cache images on Ubuntu backend.
- Pure in-memory streaming proxy with 1-time transient retry.
"""

import asyncio
from typing import Any, Dict, List, Optional, Tuple
import httpx

from app.core.config import settings
from app.core.logging import logger


class VisionGatewayService:
    def __init__(
        self,
        base_url: Optional[str] = None,
        timeout: Optional[int] = None,
        health_timeout: Optional[int] = None,
    ):
        self.base_url = (base_url or settings.VISION_SERVER_URL).rstrip("/")
        self.timeout = timeout or settings.VISION_TIMEOUT
        self.health_timeout = health_timeout or settings.VISION_HEALTH_TIMEOUT

    async def check_health(self) -> Dict[str, Any]:
        """Proxy health check to local Vision Server with 5s timeout."""
        target_url = f"{self.base_url}/api/vision/health"
        logger.info(f"[VisionGateway] Checking health: {target_url}")

        try:
            async with httpx.AsyncClient(timeout=self.health_timeout) as client:
                response = await client.get(target_url)
                response.raise_for_status()
                return response.json()
        except httpx.ConnectError as err:
            logger.warning(f"[VisionGateway] Connection refused to {target_url}: {err}")
            return {
                "status": "offline",
                "modelLoaded": False,
                "error": "Vision Server Offline",
                "detail": f"Could not connect to Vision server at {self.base_url}",
            }
        except httpx.TimeoutException as err:
            logger.warning(f"[VisionGateway] Health check timed out ({self.health_timeout}s): {err}")
            return {
                "status": "timeout",
                "modelLoaded": False,
                "error": "Vision Server Timeout",
                "detail": f"Health check timed out after {self.health_timeout}s",
            }
        except Exception as err:
            logger.error(f"[VisionGateway] Health check error: {err}")
            return {
                "status": "error",
                "modelLoaded": False,
                "error": "Vision Server Unavailable",
                "detail": str(err),
            }

    async def get_model_info(self) -> Dict[str, Any]:
        """Proxy model info request to local Vision Server."""
        target_url = f"{self.base_url}/api/vision/model-info"
        logger.info(f"[VisionGateway] Fetching model info: {target_url}")

        async with httpx.AsyncClient(timeout=self.health_timeout) as client:
            response = await client.get(target_url)
            response.raise_for_status()
            return response.json()

    async def analyze_image(
        self,
        file_bytes: bytes,
        filename: str = "screenshot.jpg",
        content_type: str = "image/jpeg",
    ) -> Dict[str, Any]:
        """
        Proxies image analysis to Local Vision Server.
        Streams file bytes in-memory; never writes to disk or database.
        Retries once on transient connection errors.
        """
        target_url = f"{self.base_url}/api/vision/analyze"
        logger.info(
            f"[VisionGateway] Forwarding screenshot analysis: {filename} ({len(file_bytes)} bytes) -> {target_url}"
        )

        last_err: Optional[Exception] = None
        for attempt in range(2):
            try:
                files = {"image": (filename, file_bytes, content_type)}
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.post(target_url, files=files)
                    response.raise_for_status()
                    return response.json()
            except (httpx.ConnectError, httpx.ConnectTimeout) as err:
                last_err = err
                logger.warning(
                    f"[VisionGateway] Attempt {attempt + 1}/2 failed connecting to {target_url}: {err}"
                )
                if attempt == 0:
                    await asyncio.sleep(0.5)  # brief backoff before single retry
            except httpx.TimeoutException as err:
                logger.error(f"[VisionGateway] Vision inference timed out ({self.timeout}s): {err}")
                raise
            except httpx.HTTPStatusError as err:
                logger.error(
                    f"[VisionGateway] Vision server returned HTTP {err.response.status_code}: {err.response.text}"
                )
                raise
            except Exception as err:
                logger.error(f"[VisionGateway] Unexpected error forwarding to vision server: {err}")
                raise

        if last_err:
            raise last_err

        raise RuntimeError("Vision gateway analysis failed unexpectedly without exception.")

    async def analyze_batch(
        self,
        files_data: List[Tuple[str, bytes, str]],
    ) -> Dict[str, Any]:
        """
        Proxies batch analysis to Local Vision Server.
        Streams multipart images in-memory sequentially.
        """
        target_url = f"{self.base_url}/api/vision/batch"
        logger.info(f"[VisionGateway] Forwarding batch analysis ({len(files_data)} images) -> {target_url}")

        files = [
            ("images", (filename, data, "image/jpeg"))
            for (_, data, filename) in files_data
        ]

        async with httpx.AsyncClient(timeout=self.timeout * max(1, len(files_data))) as client:
            response = await client.post(target_url, files=files)
            response.raise_for_status()
            return response.json()


vision_gateway_service = VisionGatewayService()
