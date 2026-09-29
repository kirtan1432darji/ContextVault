"""
Florence Gateway Service for ContextVault.
Proxies Specialist Visual Extraction requests from backend/mobile clients
to the dedicated Local Florence-2 Server on port 8002.

Provides:
- OCR with 2D bounding boxes and quadrilateral regions
- Detailed scene and UI descriptions
- UI element bounding boxes
- Zero disk storage (in-memory streaming)
"""

import asyncio
import time
from typing import Any, Dict, List, Optional
import httpx

from app.core.config import settings
from app.core.logging import logger


class FlorenceGatewayService:
    def __init__(
        self,
        base_url: Optional[str] = None,
        timeout: Optional[int] = None,
        health_timeout: Optional[int] = None,
    ):
        self.base_url = (base_url or settings.FLORENCE_SERVER_URL).rstrip("/")
        self.timeout = timeout or settings.FLORENCE_TIMEOUT
        self.health_timeout = health_timeout or settings.FLORENCE_HEALTH_TIMEOUT
        raw_candidates = [
            self.base_url,
            "http://127.0.0.1:8002",
            "http://localhost:8002",
            "http://host.docker.internal:8002",
            "http://192.168.100.2:8002",
            "http://10.187.86.96:8002",
        ]
        seen = set()
        self.candidate_urls = [
            u.rstrip("/") for u in raw_candidates if u and not (u.rstrip("/") in seen or seen.add(u.rstrip("/")))
        ]

    async def get_active_base_url(self) -> str:
        """Verifies current base_url or auto-discovers active Florence server from candidate URLs."""
        async with httpx.AsyncClient(timeout=1.5) as client:
            try:
                res = await client.get(f"{self.base_url}/health")
                if res.status_code == 200:
                    return self.base_url
            except Exception:
                pass

            for candidate in self.candidate_urls:
                if candidate == self.base_url:
                    continue
                try:
                    res = await client.get(f"{candidate}/health")
                    if res.status_code == 200:
                        logger.info(f"[FlorenceGateway] Auto-discovered active Florence server at {candidate}")
                        self.base_url = candidate
                        return self.base_url
                except Exception:
                    continue

        return self.base_url

    async def ping_server(self) -> Dict[str, Any]:
        """Measures roundtrip latency to Florence-2 server."""
        active_url = await self.get_active_base_url()
        t0 = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=float(self.health_timeout)) as client:
                res = await client.get(f"{active_url}/health")
                latency_ms = round((time.perf_counter() - t0) * 1000, 1)
                if res.status_code == 200:
                    data = res.json()
                    return {
                        "online": True,
                        "latency_ms": latency_ms,
                        "status": data.get("status", "healthy"),
                        "model": data.get("model", settings.FLORENCE_MODEL),
                        "gpu": data.get("gpu"),
                        "active_url": active_url,
                    }
                return {
                    "online": False,
                    "latency_ms": latency_ms,
                    "status": "error",
                    "error": f"HTTP {res.status_code}",
                }
        except Exception as e:
            latency_ms = round((time.perf_counter() - t0) * 1000, 1)
            return {
                "online": False,
                "latency_ms": latency_ms,
                "status": "offline",
                "error": str(e),
            }

    async def check_health(self) -> Dict[str, Any]:
        active_url = await self.get_active_base_url()
        try:
            async with httpx.AsyncClient(timeout=float(self.health_timeout)) as client:
                res = await client.get(f"{active_url}/health")
                if res.status_code == 200:
                    return res.json()
                return {"status": "unhealthy", "online": False, "error": f"HTTP {res.status_code}"}
        except Exception as e:
            return {"status": "offline", "online": False, "error": str(e)}

    async def get_model_info(self) -> Dict[str, Any]:
        active_url = await self.get_active_base_url()
        try:
            async with httpx.AsyncClient(timeout=float(self.health_timeout)) as client:
                res = await client.get(f"{active_url}/model-info")
                if res.status_code == 200:
                    return res.json()
                return {"error": f"HTTP {res.status_code}"}
        except Exception as e:
            return {"error": str(e)}

    async def extract_visual_evidence(
        self,
        file_bytes: bytes,
        filename: str = "screenshot.jpg",
        content_type: str = "image/jpeg",
    ) -> Dict[str, Any]:
        """
        Streams screenshot in-memory to Florence-2 server for visual extraction.
        Returns OCR text with regions, dense captions, and UI bounding boxes.
        """
        active_url = await self.get_active_base_url()
        t0 = time.perf_counter()

        files = {"image": (filename, file_bytes, content_type)}
        try:
            async with httpx.AsyncClient(timeout=float(self.timeout)) as client:
                res = await client.post(f"{active_url}/extract", files=files)
                if res.status_code == 200:
                    data = res.json()
                    data["gateway_latency_ms"] = round((time.perf_counter() - t0) * 1000, 1)
                    return data
                logger.error(f"[FlorenceGateway] extraction failed HTTP {res.status_code}: {res.text}")
                return {
                    "success": False,
                    "error": f"Florence Server returned HTTP {res.status_code}",
                    "details": res.text,
                }
        except Exception as e:
            logger.error(f"[FlorenceGateway] extraction exception: {e}")
            return {
                "success": False,
                "error": "Failed to connect to Florence-2 server",
                "details": str(e),
            }


florence_gateway_service = FlorenceGatewayService()
