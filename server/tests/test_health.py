async def test_health_returns_success_envelope(client):
    r = await client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["data"]["status"] == "ok"
    assert body["data"]["db"] == "ok", "Postgres unreachable - run: docker compose up -d db"
    assert r.headers["x-request-id"]


async def test_unknown_route_uses_error_envelope(client):
    r = await client.get("/api/v1/nope")
    assert r.status_code == 404
    assert r.json() == {
        "success": False,
        "error": {"code": "NOT_FOUND", "message": "Not Found"},
    }

