from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response
from app.core.security import decode_token


class JWTValidationMiddleware(BaseHTTPMiddleware):
    """Optional passive middleware that populates request.state.auth_claims if valid Bearer token exists."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1].strip()
            try:
                claims = decode_token(token)
                request.state.auth_claims = claims
            except Exception:
                request.state.auth_claims = None
        else:
            request.state.auth_claims = None

        return await call_next(request)
