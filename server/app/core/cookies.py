"""Cookie transport for access and refresh credentials."""

from fastapi import Response

from app.core.config import settings

ACCESS_COOKIE = "gt_access"
REFRESH_COOKIE = "gt_refresh"
ACCESS_COOKIE_PATH = "/"
REFRESH_COOKIE_PATH = "/api/v1/auth"


def set_access_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        ACCESS_COOKIE,
        token,
        max_age=settings.access_token_expire_minutes * 60,
        httponly=True,
        path=ACCESS_COOKIE_PATH,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        domain=settings.cookie_domain,
    )


def set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        REFRESH_COOKIE,
        token,
        max_age=settings.session_expire_days * 86400,
        httponly=True,
        path=REFRESH_COOKIE_PATH,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        domain=settings.cookie_domain,
    )


def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    set_access_cookie(response, access_token)
    set_refresh_cookie(response, refresh_token)


def clear_access_cookie(response: Response) -> None:
    response.delete_cookie(
        ACCESS_COOKIE,
        path=ACCESS_COOKIE_PATH,
        domain=settings.cookie_domain,
        samesite=settings.cookie_samesite,
    )


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        REFRESH_COOKIE,
        path=REFRESH_COOKIE_PATH,
        domain=settings.cookie_domain,
        samesite=settings.cookie_samesite,
    )


def clear_auth_cookies(response: Response) -> None:
    clear_access_cookie(response)
    clear_refresh_cookie(response)
