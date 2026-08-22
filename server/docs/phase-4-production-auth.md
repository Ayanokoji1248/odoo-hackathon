# Phase 4 production auth

This is the production-auth retrofit after the temporary one-cookie session
flow. Rate limiting and structured auth-event logging were intentionally skipped
for hackathon scope; the auth protocol itself is live.

Registration collects first name, last name, email, password, and optional
phone, city, country and additional information - see **Registration fields**.

## Contract

Register and login return `UserRead` in the response body and set two httpOnly
cookies:

| Cookie | Path | Lifetime | Contents |
|---|---|---:|---|
| `gt_access` | `/` | 15 minutes | signed JWT with `sub` user id and `sid` session id |
| `gt_refresh` | `/api/v1/auth` | 30 days | opaque refresh token; only its sha256 hash is stored |

No token is returned in JSON. The frontend must use `credentials: "include"`.

## Registration fields

`POST /api/v1/auth/register` accepts:

| Field | Required | Column | Notes |
|---|---|---|---|
| `first_name` | **yes** | `varchar(60)` | |
| `last_name` | **yes** | `varchar(60)` | |
| `email` | **yes** | `citext UNIQUE` | case-insensitive uniqueness in the DB |
| `password` | **yes** | -> `password_hash` | 8-72 chars, bcrypt |
| `phone` | no | `varchar(32) UNIQUE` | normalised before insert - see below |
| `city` | no | `varchar(120)` | free text |
| `country` | no | `varchar(120)` | free text |
| `additional_info` | no | `text` | max 2000 chars |

`users.name` no longer exists. `UserRead` still exposes a `name` field, derived
by the `User.name` property as `first_name + " " + last_name`, so the frontend's
`User.name` keeps working without a coordinated change. Migration
`638f8090ac82` splits the old column with `split_part` on the first space and
only drops it after the backfill succeeds, so existing accounts keep their names.

`city` and `country` are **free text, not FKs to `cities`**. That table is a
curated catalogue of 54 travel destinations; a user's home town usually is not
one of them.

### Phone normalisation is load-bearing

`phone` is `UNIQUE`, which only means anything if the same number always stores
as the same string. `normalize_phone` in
[app/schemas/auth.py](../app/schemas/auth.py) strips ` -()._` and rejects
anything that is not 7-20 digits with an optional leading `+`:

```
"+91 98765 43210"  ->  "+919876543210"
"+91-98765-43210"  ->  "+919876543210"   same row, so the second signup 409s
"12"               ->  400 VALIDATION_ERROR on field "phone"
```

Blank input becomes `NULL`, not `""`. This matters: HTML forms submit `""` for
every skipped field, and `""` in a unique column collides with the next blank
signup. The frontend also omits empty optional fields entirely
([src/lib/api/auth.ts](../../client/src/lib/api/auth.ts)) - belt and braces.

### Two unique columns means two conflicts

`register` no longer maps every `IntegrityError` to "email already exists".
`conflict_from_unique_violation` in
[app/core/exceptions.py](../app/core/exceptions.py) matches the constraint name
in the driver message and answers accordingly:

| Constraint | 409 message |
|---|---|
| `uq_users_email` | `An account with that email already exists` |
| `uq_users_phone` | `An account with that phone number already exists` |

Those names are stable because `Base.metadata`'s naming convention fixes them.

`PATCH /users/me` runs through the same helper - `phone` is unique, so a profile
edit can collide exactly like a registration can.

**Accepted trade-off:** a unique phone means `An account with that phone number
already exists` confirms that a number is registered. That is account
enumeration by phone, and it is the unavoidable cost of the uniqueness
constraint. Login errors stay generic; this one cannot be.

## Hot path

`get_current_user` reads only `gt_access`, verifies the JWT signature and expiry,
extracts `sub` and `sid`, then loads the user row to check `is_active`.

It does not query `sessions` on every request. Revoking a session prevents future
refreshes, while an already-issued access token remains valid until its 15-minute
expiry unless the browser cookie is cleared.

## Refresh rotation

`POST /api/v1/auth/refresh` reads `gt_refresh`.

Current-token path:

1. Lock the matching `sessions.refresh_token_hash` row.
2. Reject revoked or expired sessions.
3. Move current hash to `prev_refresh_token_hash`.
4. Store the new refresh hash.
5. Set `rotated_at` and `last_used_at`.
6. Return new access and refresh cookies.

Previous-token path:

- If the previous hash is presented within 30 seconds of `rotated_at`, it is
  treated as a parallel request and receives only a new access cookie.
- If it is presented after 30 seconds, the session is revoked and the request
  returns `401 Refresh token reuse detected`.

## Session management

| Method | Path | Behavior |
|---|---|---|
| `POST` | `/auth/logout` | idempotently marks the refresh session revoked and clears both cookies |
| `GET` | `/auth/sessions` | lists live, unexpired sessions for the current user |
| `DELETE` | `/auth/sessions/{id}` | revokes one of the current user's sessions |
| `DELETE` | `/auth/sessions` | revokes all current user's sessions and clears this browser |

Password reset and password change revoke every refresh session. Account deletion
still cascades and removes session rows.

## Frontend

Next.js rewrites `/api/v1/:path*` to the FastAPI backend. The client fetch layer
uses a single module-level refresh promise, so four simultaneous `401` responses
produce one `/auth/refresh` call, then retry behind it.

## Verification

Covered by `tests/test_auth.py`:

- cookie flags and path scoping
- invalid and expired access JWTs
- signature-only hot path
- refresh rotation
- 30-second grace window
- late previous-token reuse theft detection
- logout revocation by flag
- session list and revoke endpoints
- password reset and password change session revocation
