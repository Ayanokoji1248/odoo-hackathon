USERS = "/api/v1/users"


async def test_patch_me_only_touches_supplied_fields(client, auth):
    r = await client.patch(f"{USERS}/me", json={"language": "fr"}, headers=auth["headers"])
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["language"] == "fr"
    assert data["name"] == "Ada", "an omitted field must be left alone"


async def test_change_password_signs_out_every_session(client, auth, register_payload):
    r = await client.patch(
        f"{USERS}/me/password",
        json={
            "current_password": register_payload["password"],
            "new_password": "anotherpassword1",
        },
        headers=auth["headers"],
    )
    assert r.status_code == 200, r.text

    stale = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": auth["tokens"]["refresh_token"]}
    )
    assert stale.status_code == 401

    fresh = await client.post(
        "/api/v1/auth/login",
        json={"email": "ada@example.com", "password": "anotherpassword1"},
    )
    assert fresh.status_code == 200


async def test_change_password_with_wrong_current_is_401(client, auth):
    r = await client.patch(
        f"{USERS}/me/password",
        json={"current_password": "notmypassword", "new_password": "anotherpassword1"},
        headers=auth["headers"],
    )
    assert r.status_code == 401
