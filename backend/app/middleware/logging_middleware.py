import time
import uuid
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response
from app.core.logging import logger


class LoggingAndRequestIdMiddleware(BaseHTTPMiddleware):
    """Middleware attaching request IDs and logging execution latency for each API call."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Generate or capture incoming request ID
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id

        start_time = time.perf_counter()
        method = request.method
        path = request.url.path

        try:
            response = await call_next(request)
            process_time = (time.perf_counter() - start_time) * 1000.0

            response.headers["X-Request-ID"] = request_id
            response.headers["X-Process-Time"] = f"{process_time:.2f}ms"

            # Log non-healthcheck API traffic
            if not path.endswith("/health"):
                logger.info(
                    f"[{request_id}] {method} {path} - {response.status_code} ({process_time:.2f}ms)"
                )
            return response
        except Exception as exc:
            process_time = (time.perf_counter() - start_time) * 1000.0
            logger.error(
                f"[{request_id}] {method} {path} - ERROR ({process_time:.2f}ms): {exc}",
                exc_info=True,
            )
            raise
