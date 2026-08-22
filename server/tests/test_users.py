from sqlalchemy import func, select

from app.db.session import SessionLocal
from app.models.user import UserSession

USERS = "/api/v1/users"


async def test_patch_me_only_touches_supplied_fields(client, auth):
    r = await client.patch(f"{USERS}/me", json={"language": "fr"})
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["language"] == "fr"
    assert data["name"] == "Ada Lovelace", "an omitted field must be left alone"


async def test_change_password_signs_out_every_session(client, auth, register_payload):
    r = await client.patch(
        f"{USERS}/me/password",
        json={
            "current_password": register_payload["password"],
            "new_password": "anotherpassword1",
        },
    )
    assert r.status_code == 200, r.text

    # The browser is signed out and every refresh session is revoked.
    assert (await client.get("/api/v1/auth/me")).status_code == 401
    async with SessionLocal() as db:
        live = await db.scalar(
            select(func.count())
            .select_from(UserSession)
            .where(UserSession.revoked_at.is_(None))
        )
    assert live == 0

    fresh = await client.post(
        "/api/v1/auth/login",
        json={"email": "ada@example.com", "password": "anotherpassword1"},
    )
    assert fresh.status_code == 200


async def test_change_password_with_wrong_current_is_401(client, auth):
    r = await client.patch(
        f"{USERS}/me/password",
        json={"current_password": "notmypassword", "new_password": "anotherpassword1"},
    )
    assert r.status_code == 401


async def test_patch_me_updates_the_new_profile_fields(client, auth):
    r = await client.patch(
        f"{USERS}/me",
        json={"first_name": "Augusta", "city": "Pune", "phone": "+91 91234 56789"},
    )
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["first_name"] == "Augusta"
    assert data["last_name"] == "Lovelace", "an omitted field must be left alone"
    assert data["name"] == "Augusta Lovelace", "the derived name follows the parts"
    assert data["city"] == "Pune"
    assert data["phone"] == "+919123456789", "normalised on update too"


async def test_patching_a_phone_someone_else_owns_is_a_conflict(client, auth, make_client):
    async with make_client() as other:
        r = await other.post(
            "/api/v1/auth/register",
            json={
                "first_name": "Other",
                "last_name": "Person",
                "email": "other@example.com",
                "password": "hunter2hunter2",
                "phone": "+911112223333",
            },
        )
        assert r.status_code == 201, r.text

    clash = await client.patch(f"{USERS}/me", json={"phone": "+91 111 222 3333"})
    assert clash.status_code == 409, clash.text
    assert "phone" in clash.json()["error"]["message"].lower()
