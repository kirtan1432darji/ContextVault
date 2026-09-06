from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy.exc import SQLAlchemyError
from app.schemas.api_response import ApiResponse
from app.core.logging import logger


def register_exception_handlers(app: FastAPI) -> None:
    """Register uniform global exception handlers returning standard ApiResponse envelopes."""

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        detail_msg = exc.detail if isinstance(exc.detail, str) else "HTTP Exception"
        errors = [detail_msg] if isinstance(exc.detail, str) else [str(exc.detail)]
        response_body = ApiResponse.fail(
            message=detail_msg,
            errors=errors,
            data={},
        )
        return JSONResponse(
            status_code=exc.status_code,
            content=response_body.model_dump(),
            headers=getattr(exc, "headers", None),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        errors = []
        for error in exc.errors():
            loc = " -> ".join(str(item) for item in error.get("loc", []))
            msg = error.get("msg", "Invalid value")
            errors.append(f"{loc}: {msg}")

        response_body = ApiResponse.fail(
            message="Request validation failed.",
            errors=errors,
            data={},
        )
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=response_body.model_dump(),
        )

    @app.exception_handler(SQLAlchemyError)
    async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
        logger.error(f"Database error on {request.method} {request.url.path}: {exc}", exc_info=True)
        response_body = ApiResponse.fail(
            message="A database persistence error occurred.",
            errors=["Database transaction failed. Please retry later."],
            data={},
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=response_body.model_dump(),
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled exception on {request.method} {request.url.path}: {exc}", exc_info=True)
        response_body = ApiResponse.fail(
            message="Internal server error.",
            errors=["An unexpected server error occurred."],
            data={},
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=response_body.model_dump(),
        )
