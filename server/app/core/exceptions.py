import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger(__name__)

# code -> default HTTP status
CODE_STATUS = {
    "VALIDATION_ERROR": 400,
    "UNAUTHORIZED": 401,
    "FORBIDDEN": 403,
    "NOT_FOUND": 404,
    "CONFLICT": 409,
    "RATE_LIMITED": 429,
    "INTERNAL_ERROR": 500,
}
STATUS_CODE = {v: k for k, v in CODE_STATUS.items()}


class ApiError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        status_code: int | None = None,
        details: list[dict] | None = None,
    ) -> None:
        self.code = code
        self.message = message
        self.status_code = status_code or CODE_STATUS.get(code, 400)
        self.details = details
        super().__init__(message)


# Constraint name -> the message the user should see. The names are stable
# because Base.metadata's naming convention fixes them (uq_<table>_<columns>).
UNIQUE_VIOLATION_MESSAGES = {
    "uq_users_email": "An account with that email already exists",
    "uq_users_phone": "An account with that phone number already exists",
}


def conflict_from_unique_violation(exc: Exception, default: str) -> ApiError:
    """Turn a Postgres unique violation into a 409 that names the field.

    `users` has two unique columns now, so "duplicate" is no longer a single
    error - answering only "already exists" leaves the user guessing which field
    to change. ponytail: matched by substring on the driver's message rather
    than reaching through SQLAlchemy's DBAPI wrapper for `.constraint_name`,
    which differs per driver.
    """
    text = str(getattr(exc, "orig", exc))
    for constraint, message in UNIQUE_VIOLATION_MESSAGES.items():
        if constraint in text:
            return ApiError("CONFLICT", message)
    return ApiError("CONFLICT", default)


def error_response(
    status: int, code: str, message: str, details: list[dict] | None = None
) -> JSONResponse:
    error: dict = {"code": code, "message": message}
    if details:
        error["details"] = details
    return JSONResponse(status_code=status, content={"success": False, "error": error})


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api_error(_: Request, exc: ApiError) -> JSONResponse:
        return error_response(exc.status_code, exc.code, exc.message, exc.details)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        details = [
            {
                # drop the "body"/"query" prefix — the client cares about the field
                "field": ".".join(str(p) for p in err["loc"][1:]) or str(err["loc"][0]),
                "message": err["msg"],
            }
            for err in exc.errors()
        ]
        return error_response(400, "VALIDATION_ERROR", "Invalid input", details)

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = STATUS_CODE.get(exc.status_code, "INTERNAL_ERROR")
        return error_response(exc.status_code, code, str(exc.detail))

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        log.exception("unhandled error on %s %s", request.method, request.url.path)
        return error_response(500, "INTERNAL_ERROR", "Something went wrong")
