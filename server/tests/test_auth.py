from sqlalchemy import func, select, text

from app.db.session import SessionLocal
from app.models.user import RefreshToken

AUTH = "/api/v1/auth"


async def test_register_returns_user_and_tokens(client, register_payload):
    r = await client.post(f"{AUTH}/register", json=register_payload)
    assert r.status_code == 201, r.text
    data = r.json()["data"]
    # pydantic's EmailStr lowercases the domain; citext makes the rest case-insensitive
    assert data["user"]["email"].lower() == register_payload["email"].lower()
    assert data["user"]["role"] == "USER"
    assert "password_hash" not in data["user"] and "password" not in data["user"]
    assert data["tokens"]["access_token"] and data["tokens"]["refresh_token"]
    assert data["tokens"]["expires_in"] == 15 * 60


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


async def test_login_and_me(client, register_payload, auth):
    r = await client.post(
        f"{AUTH}/login",
        json={"email": "ada@example.com", "password": register_payload["password"]},
    )
    assert r.status_code == 200, r.text
    token = r.json()["data"]["tokens"]["access_token"]

    me = await client.get(f"{AUTH}/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["data"]["name"] == "Ada"


async def test_login_with_wrong_password_is_401(client, auth):
    r = await client.post(
        f"{AUTH}/login", json={"email": "ada@example.com", "password": "wrongwrongwrong"}
    )
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "UNAUTHORIZED"


async def test_me_without_token_is_401_envelope(client):
    r = await client.get(f"{AUTH}/me")
    assert r.status_code == 401
    assert r.json() == {
        "success": False,
        "error": {"code": "UNAUTHORIZED", "message": "Missing bearer token"},
    }


async def test_refresh_rotates_and_burns_the_old_token(client, auth):
    old = auth["tokens"]["refresh_token"]

    r = await client.post(f"{AUTH}/refresh", json={"refresh_token": old})
    assert r.status_code == 200, r.text
    new = r.json()["data"]["refresh_token"]
    assert new != old

    reuse = await client.post(f"{AUTH}/refresh", json={"refresh_token": old})
    assert reuse.status_code == 401, "a rotated refresh token must not work twice"

    assert (await client.post(f"{AUTH}/refresh", json={"refresh_token": new})).status_code == 200


async def test_logout_revokes_the_refresh_token(client, auth):
    r = await client.post(
        f"{AUTH}/logout",
        json={"refresh_token": auth["tokens"]["refresh_token"]},
        headers=auth["headers"],
    )
    assert r.status_code == 200

    after = await client.post(
        f"{AUTH}/refresh", json={"refresh_token": auth["tokens"]["refresh_token"]}
    )
    assert after.status_code == 401


async def test_forgot_password_never_reveals_whether_the_account_exists(client, auth):
    known = await client.post(f"{AUTH}/forgot-password", json={"email": "ada@example.com"})
    unknown = await client.post(f"{AUTH}/forgot-password", json={"email": "nobody@example.com"})
    assert known.status_code == unknown.status_code == 200
    assert known.json()["data"]["message"] == unknown.json()["data"]["message"]
    assert "reset_token" not in unknown.json()["data"]


async def test_reset_password_flow(client, auth, register_payload):
    token = (
        await client.post(f"{AUTH}/forgot-password", json={"email": "ada@example.com"})
    ).json()["data"]["reset_token"]

    r = await client.post(
        f"{AUTH}/reset-password", json={"token": token, "new_password": "brandnewpassword"}
    )
    assert r.status_code == 200, r.text

    old = await client.post(
        f"{AUTH}/login",
        json={"email": "ada@example.com", "password": register_payload["password"]},
    )
    assert old.status_code == 401
    new = await client.post(
        f"{AUTH}/login", json={"email": "ada@example.com", "password": "brandnewpassword"}
    )
    assert new.status_code == 200

    # every pre-reset session is dead
    stale = await client.post(
        f"{AUTH}/refresh", json={"refresh_token": auth["tokens"]["refresh_token"]}
    )
    assert stale.status_code == 401

    reuse = await client.post(
        f"{AUTH}/reset-password", json={"token": token, "new_password": "yetanotherpassword"}
    )
    assert reuse.status_code == 400, "a used reset token must not work twice"


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


async def test_refresh_tokens_are_stored_hashed(client, auth):
    raw = auth["tokens"]["refresh_token"]
    async with SessionLocal() as db:
        hashes = (await db.execute(select(RefreshToken.token_hash))).scalars().all()
    assert hashes and raw not in hashes
    assert all(len(h) == 64 for h in hashes)


async def test_deleting_the_account_leaves_no_orphan_tokens(client, auth):
    r = await client.delete("/api/v1/users/me", headers=auth["headers"])
    assert r.status_code == 200

    assert (await client.get(f"{AUTH}/me", headers=auth["headers"])).status_code == 401
    async with SessionLocal() as db:
        assert await db.scalar(select(func.count()).select_from(RefreshToken)) == 0
