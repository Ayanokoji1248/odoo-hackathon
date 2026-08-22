from datetime import UTC, datetime, timedelta

import jwt
from sqlalchemy import func, select, text

from app.core.config import settings
from app.core.cookies import ACCESS_COOKIE, REFRESH_COOKIE
from app.core.security import JWT_ALGORITHM, hash_token
from app.db.session import SessionLocal
from app.models.user import User, UserSession

AUTH = "/api/v1/auth"


def set_cookie_headers(response) -> dict[str, str]:
    """Raw Set-Cookie lines keyed by cookie name, so flags can be asserted."""
    return {
        line.split("=", 1)[0]: line
        for line in response.headers.get_list("set-cookie")
    }


async def test_register_returns_the_user_and_nothing_else(client, register_payload):
    r = await client.post(f"{AUTH}/register", json=register_payload)
    assert r.status_code == 201, r.text
    data = r.json()["data"]

    assert data["email"].lower() == register_payload["email"].lower()
    assert data["role"] == "USER"
    assert "password" not in r.text

    access = client.cookies[ACCESS_COOKIE]
    refresh = client.cookies[REFRESH_COOKIE]
    assert access and access not in r.text
    assert refresh and refresh not in r.text


async def test_auth_cookies_carry_the_right_flags_and_paths(client, register_payload):
    r = await client.post(f"{AUTH}/register", json=register_payload)
    headers = set_cookie_headers(r)
    access = headers[ACCESS_COOKIE]
    refresh = headers[REFRESH_COOKIE]

    assert "HttpOnly" in access
    assert "HttpOnly" in refresh
    assert "SameSite=lax" in access
    assert "SameSite=lax" in refresh
    assert "Path=/;" in access or access.endswith("Path=/")
    assert "Path=/api/v1/auth;" in refresh or refresh.endswith("Path=/api/v1/auth")


async def test_duplicate_email_is_case_insensitive_conflict(client, register_payload, auth):
    r = await client.post(f"{AUTH}/register", json={**register_payload, "email": "ADA@example.COM"})
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "CONFLICT"


async def test_short_password_is_a_validation_error(client, register_payload):
    r = await client.post(f"{AUTH}/register", json={**register_payload, "password": "short"})
    assert r.status_code == 400
    body = r.json()
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert body["error"]["details"][0]["field"] == "password"


async def test_access_cookie_authenticates_every_method(client, register_payload, auth):
    r = await client.post(
        f"{AUTH}/login",
        json={"email": "ada@example.com", "password": register_payload["password"]},
    )
    assert r.status_code == 200, r.text

    me = await client.get(f"{AUTH}/me")
    assert me.status_code == 200
    assert me.json()["data"]["name"] == "Ada Lovelace"

    patch = await client.patch("/api/v1/users/me", json={"language": "fr"})
    assert patch.status_code == 200, patch.text


async def test_login_with_wrong_password_is_401(client, auth):
    r = await client.post(
        f"{AUTH}/login", json={"email": "ada@example.com", "password": "wrongwrongwrong"}
    )
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "UNAUTHORIZED"


async def test_me_without_an_access_cookie_is_401(client):
    r = await client.get(f"{AUTH}/me")
    assert r.status_code == 401
    assert r.json() == {
        "success": False,
        "error": {"code": "UNAUTHORIZED", "message": "Not signed in"},
    }


async def test_forged_access_cookie_is_401(make_client):
    async with make_client(cookies={ACCESS_COOKIE: "not-a-real-jwt"}) as c:
        r = await c.get(f"{AUTH}/me")
    assert r.status_code == 401
    assert r.json()["error"]["message"] == "Invalid access token"


async def test_expired_access_cookie_is_401(client, auth, make_client):
    async with SessionLocal() as db:
        user = (await db.execute(select(User))).scalars().one()
        session = (await db.execute(select(UserSession))).scalars().one()

    now = datetime.now(UTC)
    expired = jwt.encode(
        {
            "sub": str(user.id),
            "sid": str(session.id),
            "iat": now - timedelta(minutes=30),
            "exp": now - timedelta(minutes=1),
        },
        settings.jwt_secret,
        algorithm=JWT_ALGORITHM,
    )
    async with make_client(cookies={ACCESS_COOKIE: expired}) as c:
        r = await c.get(f"{AUTH}/me")
    assert r.status_code == 401
    assert r.json()["error"]["message"] == "Access token expired"


async def test_access_hot_path_does_not_check_session_revocation(client, auth):
    async with SessionLocal() as db:
        row = (await db.execute(select(UserSession))).scalars().one()
        row.revoked_at = datetime.now(UTC)
        await db.commit()

    assert (await client.get(f"{AUTH}/me")).status_code == 200
    assert (await client.post(f"{AUTH}/refresh")).status_code == 401


async def test_refresh_rotates_the_refresh_cookie(client, auth):
    old_refresh = client.cookies[REFRESH_COOKIE]

    r = await client.post(f"{AUTH}/refresh")
    assert r.status_code == 200, r.text
    assert client.cookies[REFRESH_COOKIE] != old_refresh

    async with SessionLocal() as db:
        row = (await db.execute(select(UserSession))).scalars().one()
    assert row.refresh_token_hash == hash_token(client.cookies[REFRESH_COOKIE])
    assert row.prev_refresh_token_hash == hash_token(old_refresh)
    assert row.rotated_at is not None


async def test_refresh_grace_window_allows_the_previous_token_once_recently_rotated(
    client, auth, make_client
):
    old_refresh = client.cookies[REFRESH_COOKIE]
    assert (await client.post(f"{AUTH}/refresh")).status_code == 200

    async with make_client(cookies={REFRESH_COOKIE: old_refresh}) as c:
        r = await c.post(f"{AUTH}/refresh")
    assert r.status_code == 200, r.text
    assert REFRESH_COOKIE not in set_cookie_headers(r)
    assert ACCESS_COOKIE in set_cookie_headers(r)


async def test_late_reuse_of_previous_refresh_token_revokes_the_session(client, auth, make_client):
    old_refresh = client.cookies[REFRESH_COOKIE]
    assert (await client.post(f"{AUTH}/refresh")).status_code == 200
    async with SessionLocal() as db:
        await db.execute(text("UPDATE sessions SET rotated_at = now() - interval '31 seconds'"))
        await db.commit()

    async with make_client(cookies={REFRESH_COOKIE: old_refresh}) as c:
        r = await c.post(f"{AUTH}/refresh")
    assert r.status_code == 401
    assert r.json()["error"]["message"] == "Refresh token reuse detected"

    async with SessionLocal() as db:
        row = (await db.execute(select(UserSession))).scalars().one()
    assert row.revoked_at is not None


async def test_expired_refresh_session_cannot_refresh(client, auth):
    async with SessionLocal() as db:
        await db.execute(text("UPDATE sessions SET expires_at = now() - interval '1 minute'"))
        await db.commit()
    assert (await client.post(f"{AUTH}/refresh")).status_code == 401


async def test_each_login_is_its_own_session(client, register_payload, auth, make_client):
    async with make_client() as other:
        r = await other.post(
            f"{AUTH}/login",
            json={"email": "ada@example.com", "password": register_payload["password"]},
        )
        assert r.status_code == 200
        assert (await other.get(f"{AUTH}/me")).status_code == 200
        assert (await client.get(f"{AUTH}/me")).status_code == 200

        async with SessionLocal() as db:
            assert await db.scalar(select(func.count()).select_from(UserSession)) == 2

        await other.post(f"{AUTH}/logout")
        assert (await other.get(f"{AUTH}/me")).status_code == 401
        assert (await client.get(f"{AUTH}/me")).status_code == 200


async def test_logout_revokes_the_row_and_clears_both_cookies(client, auth, make_client):
    old_refresh = client.cookies[REFRESH_COOKIE]

    r = await client.post(f"{AUTH}/logout")
    assert r.status_code == 200
    headers = set_cookie_headers(r)
    assert ACCESS_COOKIE in headers
    assert REFRESH_COOKIE in headers

    assert (await client.get(f"{AUTH}/me")).status_code == 401
    async with SessionLocal() as db:
        row = (await db.execute(select(UserSession))).scalars().one()
    assert row.revoked_at is not None

    async with make_client(cookies={REFRESH_COOKIE: old_refresh}) as c:
        assert (await c.post(f"{AUTH}/refresh")).status_code == 401


async def test_logout_without_a_cookie_is_still_200(make_client):
    async with make_client() as c:
        assert (await c.post(f"{AUTH}/logout")).status_code == 200


async def test_session_management_lists_and_revokes_sessions(client, register_payload, auth):
    second = await client.post(
        f"{AUTH}/login",
        json={"email": "ada@example.com", "password": register_payload["password"]},
    )
    assert second.status_code == 200

    listed = await client.get(f"{AUTH}/sessions")
    assert listed.status_code == 200, listed.text
    sessions = listed.json()["data"]
    assert len(sessions) == 2

    target = sessions[0]["id"]
    deleted = await client.delete(f"{AUTH}/sessions/{target}")
    assert deleted.status_code == 200

    listed = await client.get(f"{AUTH}/sessions")
    assert len(listed.json()["data"]) == 1


async def test_revoke_all_sessions_clears_this_browser(client, auth):
    r = await client.delete(f"{AUTH}/sessions")
    assert r.status_code == 200
    assert (await client.get(f"{AUTH}/me")).status_code == 401
    async with SessionLocal() as db:
        live = await db.scalar(
            select(func.count())
            .select_from(UserSession)
            .where(UserSession.revoked_at.is_(None))
        )
    assert live == 0


# --- password reset -----------------------------------------------------------


async def test_forgot_password_never_reveals_whether_the_account_exists(client, auth):
    known = await client.post(f"{AUTH}/forgot-password", json={"email": "ada@example.com"})
    unknown = await client.post(f"{AUTH}/forgot-password", json={"email": "nobody@example.com"})
    assert known.status_code == unknown.status_code == 200
    assert known.json()["data"]["message"] == unknown.json()["data"]["message"]
    assert "reset_token" not in unknown.json()["data"]


async def test_reset_password_flow(client, auth, register_payload, make_client):
    old_refresh = client.cookies[REFRESH_COOKIE]
    token = (
        await client.post(f"{AUTH}/forgot-password", json={"email": "ada@example.com"})
    ).json()["data"]["reset_token"]

    r = await client.post(
        f"{AUTH}/reset-password", json={"token": token, "new_password": "brandnewpassword"}
    )
    assert r.status_code == 200, r.text
    headers = set_cookie_headers(r)
    assert ACCESS_COOKIE in headers
    assert REFRESH_COOKIE in headers

    old = await client.post(
        f"{AUTH}/login",
        json={"email": "ada@example.com", "password": register_payload["password"]},
    )
    assert old.status_code == 401
    new = await client.post(
        f"{AUTH}/login", json={"email": "ada@example.com", "password": "brandnewpassword"}
    )
    assert new.status_code == 200

    async with make_client(cookies={REFRESH_COOKIE: old_refresh}) as c:
        assert (await c.post(f"{AUTH}/refresh")).status_code == 401

    reuse = await client.post(
        f"{AUTH}/reset-password", json={"token": token, "new_password": "yetanotherpassword"}
    )
    assert reuse.status_code == 400


async def test_expired_reset_token_is_rejected(client, auth):
    token = (
        await client.post(f"{AUTH}/forgot-password", json={"email": "ada@example.com"})
    ).json()["data"]["reset_token"]

    async with SessionLocal() as db:
        await db.execute(
            text("UPDATE password_reset_tokens SET expires_at = now() - interval '1 minute'")
        )
        await db.commit()

    r = await client.post(
        f"{AUTH}/reset-password", json={"token": token, "new_password": "brandnewpassword"}
    )
    assert r.status_code == 400


# --- storage invariants -------------------------------------------------------


async def test_refresh_tokens_are_stored_hashed(client, auth):
    raw = client.cookies[REFRESH_COOKIE]
    async with SessionLocal() as db:
        hashes = (await db.execute(select(UserSession.refresh_token_hash))).scalars().all()
    assert hashes and raw not in hashes
    assert all(len(h) == 64 for h in hashes)


async def test_deleting_the_account_leaves_no_orphan_sessions(client, auth):
    r = await client.delete("/api/v1/users/me")
    assert r.status_code == 200

    assert (await client.get(f"{AUTH}/me")).status_code == 401
    async with SessionLocal() as db:
        assert await db.scalar(select(func.count()).select_from(UserSession)) == 0


# --- registration fields ------------------------------------------------------


async def test_register_persists_every_profile_field(client, register_payload):
    r = await client.post(f"{AUTH}/register", json=register_payload)
    assert r.status_code == 201, r.text
    data = r.json()["data"]

    assert data["first_name"] == "Ada"
    assert data["last_name"] == "Lovelace"
    assert data["name"] == "Ada Lovelace", "derived, not a column"
    assert data["city"] == "Bengaluru"
    assert data["country"] == "India"
    assert data["additional_info"] == "Prefers window seats."
    # normalised on the way in - the unique constraint depends on it
    assert data["phone"] == "+919876543210"


async def test_only_the_four_core_fields_are_required(client):
    r = await client.post(
        f"{AUTH}/register",
        json={
            "first_name": "Solo",
            "last_name": "Traveller",
            "email": "solo@example.com",
            "password": "hunter2hunter2",
        },
    )
    assert r.status_code == 201, r.text
    data = r.json()["data"]
    assert data["phone"] is None
    assert data["city"] is None
    assert data["additional_info"] is None


async def test_blank_optional_fields_become_null_not_empty_strings(client):
    """An HTML form submits "" for every field the user skipped. Storing those
    would put '' in a unique column and collide with the next blank signup."""
    payload = {
        "first_name": "Blank",
        "last_name": "Fields",
        "email": "blank@example.com",
        "password": "hunter2hunter2",
        "phone": "",
        "city": "   ",
        "country": "",
        "additional_info": "  ",
    }
    first = await client.post(f"{AUTH}/register", json=payload)
    assert first.status_code == 201, first.text
    data = first.json()["data"]
    assert data["phone"] is None
    assert data["city"] is None
    assert data["country"] is None
    assert data["additional_info"] is None


async def test_two_accounts_can_both_omit_the_phone(client, make_client):
    """NULL never collides on a unique index - but '' would."""
    base = {"last_name": "T", "password": "hunter2hunter2"}
    a = await client.post(f"{AUTH}/register", json={**base, "first_name": "A", "email": "a@x.com"})
    async with make_client() as other:
        b = await other.post(
            f"{AUTH}/register", json={**base, "first_name": "B", "email": "b@x.com", "phone": ""}
        )
    assert a.status_code == 201, a.text
    assert b.status_code == 201, b.text


async def test_duplicate_phone_is_a_conflict_naming_the_phone(client, auth, make_client):
    """Differently formatted, same number: normalisation is what makes this 409."""
    async with make_client() as other:
        r = await other.post(
            f"{AUTH}/register",
            json={
                "first_name": "Copy",
                "last_name": "Cat",
                "email": "different@example.com",
                "password": "hunter2hunter2",
                "phone": "+91-98765-43210",
            },
        )
    assert r.status_code == 409, r.text
    message = r.json()["error"]["message"]
    assert "phone" in message.lower(), f"must say which field clashed, got: {message}"
    assert "email" not in message.lower()


async def test_duplicate_email_conflict_names_the_email(client, register_payload, auth):
    r = await client.post(
        f"{AUTH}/register",
        json={**register_payload, "email": "ADA@example.COM", "phone": "+911111111111"},
    )
    assert r.status_code == 409
    assert "email" in r.json()["error"]["message"].lower()


async def test_malformed_phone_is_a_validation_error(client, register_payload):
    r = await client.post(f"{AUTH}/register", json={**register_payload, "phone": "12"})
    assert r.status_code == 400
    body = r.json()
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert body["error"]["details"][0]["field"] == "phone"


async def test_missing_last_name_is_a_validation_error(client, register_payload):
    payload = {k: v for k, v in register_payload.items() if k != "last_name"}
    r = await client.post(f"{AUTH}/register", json=payload)
    assert r.status_code == 400
    assert r.json()["error"]["details"][0]["field"] == "last_name"
