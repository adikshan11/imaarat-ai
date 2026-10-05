from secrets import token_hex

from fastapi import Request
from fastapi.responses import JSONResponse


def unavailable_response() -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content={"detail": "application_not_ready", "request_id": token_hex(16)},
        headers={"Cache-Control": "no-store", "Retry-After": "30"},
    )


async def internal_error(request: Request, error: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={"detail": "internal_error", "request_id": token_hex(16)},
        headers={"Cache-Control": "no-store"},
    )