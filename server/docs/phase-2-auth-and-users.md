# Phase 2 — Auth & Users

Status: complete. 18 route-level tests. Builds on
[phase-1-foundation.md](phase-1-foundation.md) — envelopes, error codes and
config live there.

---

## 1. File map

| File | Purpose |
|---|---|
| [app/core/security.py](../app/core/security.py) | password hashing, opaque token generation, token hashing, JWT encode/decode |
| [app/models/user.py](../app/models/user.py) | `User`, `RefreshToken`, `PasswordResetToken`, `UserRole` |
| [app/schemas/auth.py](../app/schemas/auth.py) | request/response bodies for every auth route |
| [app/schemas/user.py](../app/schemas/user.py) | `UserRead` (no `password_hash`), `UserUpdate` |
| [app/services/auth_service.py](../app/services/auth_service.py) | all auth business logic and every commit |
| [app/services/user_service.py](../app/services/user_service.py) | profile update, account delete |
| [app/deps.py](../app/deps.py) | `DbSession`, `get_current_user`/`CurrentUser`, `require_admin`/`AdminUser` |
| [app/api/v1/routes/auth.py](../app/api/v1/routes/auth.py) | `/api/v1/auth/*` |
| [app/api/v1/routes/users.py](../app/api/v1/routes/users.py) | `/api/v1/users/me*` |
| [alembic/versions/dae7f6738b4c_…](../alembic/versions/dae7f6738b4c_auth_users_refresh_and_reset_tokens.py) | the tables + `citext` extension |

---

## 2. Schema

### `users`

| column | type | notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `name` | varchar(120) | |
| `email` | **citext** UNIQUE | case-insensitive uniqueness enforced by the DB |
| `password_hash` | text | bcrypt, cost 12 |
| `avatar_url` | text NULL | |
| `language` | varchar(10) | default `'en'` |
| `role` | enum `user_role` | `USER` \| `ADMIN`, default `USER` |
| `is_active` | boolean | default `true` |
| `created_at` / `updated_at` | timestamptz | |

`email` is `citext`, so `Ada@Example.com` and `ada@example.com` collide at the
unique index. There are deliberately **no `lower()` calls** in the service layer —
if you add one you have created a second, weaker source of truth.

Note: `pydantic`'s `EmailStr` lowercases the **domain** but preserves the local
part's case. So the stored value can be `Ada@example.com`. Compare
case-insensitively in any test or script that asserts on the email.

### `refresh_tokens`

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → `users` **ON DELETE CASCADE**, indexed | |
| `token_hash` | varchar(64) UNIQUE | sha256 hex of the raw token |
| `expires_at` | timestamptz | now + `REFRESH_TOKEN_EXPIRE_DAYS` |
| `revoked_at` | timestamptz NULL | set on rotation, logout, password change, reset |
| `user_agent` | varchar(255) NULL | truncated to 255 |

`RefreshToken.is_usable` is the single predicate: `revoked_at IS NULL AND expires_at > now()`.

### `password_reset_tokens`

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → `users` ON DELETE CASCADE, indexed | |
| `token_hash` | varchar(64) UNIQUE | sha256 hex |
| `expires_at` | timestamptz | now + `RESET_TOKEN_EXPIRE_MINUTES` (30) |
| `used_at` | timestamptz NULL | set on successful reset; makes the token single-use |

---

## 3. Token model

Three different token kinds, three different jobs. Mixing them up is the most
likely source of a confusing 401.

| | Access token | Refresh token | Reset token |
|---|---|---|---|
| Form | JWT (HS256) | opaque, `secrets.token_urlsafe(32)` | opaque, `secrets.token_urlsafe(32)` |
| Stored in DB? | no | yes, as sha256 | yes, as sha256 |
| Lifetime | 15 min | 7 days | 30 min |
| Revocable? | no — it just expires | yes | yes (single-use) |
| Sent as | `Authorization: Bearer <t>` | JSON body | JSON body |

Access token claims: `sub` (user id), `role`, `iat`, `exp`, `typ: "access"`.
The `typ` check exists so a future token kind signed with the same secret cannot
be replayed as an access token.

**Why sha256 and not bcrypt for the stored tokens.** These are 256 bits of
random. bcrypt's work factor exists to slow brute-forcing of *low-entropy*
human passwords; against a random 256-bit value it buys nothing and costs a
~100 ms hash on every single refresh. Passwords get bcrypt; tokens get sha256.

**bcrypt's 72-byte limit** is handled in two places: schemas cap the password at
72 characters (so an over-long password is a clean 400), and `hash_password`
truncates to 72 bytes (so a multibyte password that exceeds 72 *bytes* at 60
*characters* cannot raise a 500). Both are needed.

---

## 4. Endpoints

Base: `/api/v1`. All bodies are JSON. All responses use the envelopes from Phase 1.

| Method | Path | Auth | Body | Success |
|---|---|---|---|---|
| POST | `/auth/register` | — | `name`, `email`, `password` | **201** `{ user, tokens }` |
| POST | `/auth/login` | — | `email`, `password` | 200 `{ user, tokens }` |
| POST | `/auth/refresh` | — (token in body) | `refresh_token` | 200 `TokenPair` |
| POST | `/auth/logout` | bearer | `refresh_token` | 200 `{ revoked: true }` |
| POST | `/auth/forgot-password` | — | `email` | 200 `{ message }` (+ `reset_token` when `DEBUG`) |
| POST | `/auth/reset-password` | — | `token`, `new_password` | 200 `{ message }` |
| GET | `/auth/me` | bearer | — | 200 `UserRead` |
| PATCH | `/users/me` | bearer | any of `name`, `avatar_url`, `language` | 200 `UserRead` |
| PATCH | `/users/me/password` | bearer | `current_password`, `new_password` | 200 `{ message }` |
| DELETE | `/users/me` | bearer | — | 200 `{ deleted: true }` |

`TokenPair` = `{ access_token, refresh_token, token_type: "bearer", expires_in: 900 }`.
`expires_in` is seconds, derived from `ACCESS_TOKEN_EXPIRE_MINUTES` — do not hardcode 900 on the client.

Password rule: 8–72 characters. Anything else is a 400 with
`details[0].field == "password"`.

`PATCH /users/me` uses `model_dump(exclude_unset=True)`: an **omitted** field is
left alone, an explicit `null` clears it. That distinction is intentional and
load-bearing — do not "simplify" it to `model_dump()`.

---

## 5. Flows

### Register / login

```
POST /auth/register → insert user → insert refresh_token row → commit
                    → 201 { user, tokens }
```

Duplicate email is detected by the **unique index** (`IntegrityError` → 409), not
by a pre-flight `SELECT`. A pre-check is a race: two concurrent registrations
both see "not taken". Note the handler calls `db.rollback()` before raising —
after an `IntegrityError` the session is unusable until it does.

### Refresh (rotation)

```
POST /auth/refresh { refresh_token }
  → sha256 lookup → is_usable? → set revoked_at on the old row
  → issue a NEW access + NEW refresh → commit
```

One refresh token, one use. Presenting a spent token is a **401**. If a client
ever gets two 401s in a row from refresh, it lost the rotated value — it must
re-login, not retry.

### Password reset

```
POST /auth/forgot-password { email }
  → user found?  yes → insert reset token row, return it (DEBUG) or log it
                  no → nothing
  → 200 with an identical message either way
```

```
POST /auth/reset-password { token, new_password }
  → sha256 lookup → not used, not expired → set password_hash
  → mark used_at → revoke ALL that user's refresh tokens → commit
```

### Sessions killed on credential change

Both `PATCH /users/me/password` and `/auth/reset-password` call
`_revoke_all_refresh_tokens`. Existing **access** tokens still work for up to
15 minutes — that is the documented trade-off of stateless access tokens. Only
refresh is revocable. If you need instant global logout, that needs a token
version column on `users`, checked in `get_current_user`.

---

## 6. Authentication dependency

`get_current_user` (in [app/deps.py](../app/deps.py)) is the only place a request
becomes a `User`. It runs, in order:

1. Bearer header present? → else 401 `Missing bearer token`
2. JWT decodes, signature valid, not expired → else 401
3. `typ == "access"` → else 401 `Wrong token type`
4. `sub` parses as a UUID → else 401 `Malformed access token`
5. User row exists **and** `is_active` → else 401 `Account not found or disabled`

`HTTPBearer(auto_error=False)` is deliberate: with `auto_error=True`, FastAPI
returns its own **403** for a missing header, which is the wrong code and the
wrong envelope.

Use the aliases, not the functions:

```python
from app.deps import CurrentUser, DbSession

async def route(db: DbSession, user: CurrentUser) -> ApiResponse[Thing]: ...
```

`require_admin` / `AdminUser` exists and returns 403 `Admin access required`, but
nothing uses it until Phase 6. Per the PRD it will be applied at **router**
level, not per-endpoint.

---

## 7. Error reference

Every one of these is a real, reachable response.

| Status | Code | Message | Cause |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | `Invalid input` | body failed Pydantic; see `details[]` |
| 400 | `VALIDATION_ERROR` | `Invalid or expired reset token` | reset token unknown, used, or past `expires_at` |
| 401 | `UNAUTHORIZED` | `Missing bearer token` | no `Authorization` header |
| 401 | `UNAUTHORIZED` | `Invalid access token` | bad signature or malformed JWT |
| 401 | `UNAUTHORIZED` | `Access token expired` | older than 15 min |
| 401 | `UNAUTHORIZED` | `Wrong token type` | JWT without `typ: "access"` |
| 401 | `UNAUTHORIZED` | `Malformed access token` | `sub` is not a UUID |
| 401 | `UNAUTHORIZED` | `Account not found or disabled` | user deleted, or `is_active = false` |
| 401 | `UNAUTHORIZED` | `Invalid email or password` | login failure — same message for both, by design |
| 401 | `UNAUTHORIZED` | `Invalid or expired refresh token` | unknown, revoked, rotated, or expired |
| 401 | `UNAUTHORIZED` | `Current password is incorrect` | `PATCH /users/me/password` |
| 403 | `FORBIDDEN` | `This account has been disabled` | correct password, `is_active = false` |
| 403 | `FORBIDDEN` | `Admin access required` | `require_admin` on a `USER` |
| 409 | `CONFLICT` | `An account with that email already exists` | unique index on `email` |

Note the split on disabled accounts: **login** says 403 (credentials were right,
the account is off), while **`get_current_user`** says 401 (the token is no
longer usable). That is intentional, not an inconsistency.

---

## 8. Invariants — do not break these

1. `password_hash` never appears in a response. Guaranteed structurally: `UserRead`
   has no such field and routes never return ORM objects.
2. Raw refresh and reset tokens are never persisted. Only sha256 hex. There is a
   test asserting the raw value is absent from the table.
3. Passwords and tokens are never logged. `/auth/forgot-password` logs only the email.
4. `/auth/forgot-password` returns byte-identical output for known and unknown
   emails (aside from the `DEBUG`-only token) — no account enumeration.
5. One refresh token, one use.
6. Any credential change revokes every refresh token for that user.
7. Deleting a user leaves no token rows — FK `ON DELETE CASCADE`, verified by a test.

---

## 9. Inspecting live state

```sql
-- who exists
SELECT id, name, email, role, is_active, created_at FROM users ORDER BY created_at DESC;

-- a user's sessions: which are live, which were revoked
SELECT left(token_hash, 8) AS t, user_agent, created_at, expires_at, revoked_at,
       (revoked_at IS NULL AND expires_at > now()) AS usable
FROM refresh_tokens WHERE user_id = '<uuid>' ORDER BY created_at DESC;

-- outstanding reset tokens
SELECT left(token_hash, 8), expires_at, used_at FROM password_reset_tokens
WHERE user_id = '<uuid>' ORDER BY created_at DESC;

-- orphan check (must return 0)
SELECT count(*) FROM refresh_tokens r LEFT JOIN users u ON u.id = r.user_id WHERE u.id IS NULL;
```

Match a raw token you hold against a row:

```bash
./.venv/Scripts/python.exe -c "from app.core.security import hash_token; print(hash_token('<raw>'))"
```

Read an access token's claims without verifying:

```bash
./.venv/Scripts/python.exe -c "import jwt,sys;print(jwt.decode(sys.argv[1], options={'verify_signature':False}))" <token>
```

Manually promote someone to admin (there is no endpoint for it until Phase 6):

```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'you@example.com';
```

---

## 10. Debugging playbook

| Symptom | Likely cause | Check |
|---|---|---|
| Every request 401 `Missing bearer token` | header not sent, or named wrong | must be exactly `Authorization: Bearer <access_token>` |
| 401 `Invalid access token` right after login | `JWT_SECRET` changed since the token was issued | restart history / `.env` |
| Worked for 15 minutes then 401 | access token expired — normal | client must call `/auth/refresh` |
| 401 `Wrong token type` | the **refresh** token was sent as a bearer | refresh tokens go in the body, not the header |
| Refresh 401s on a token that just worked | it was already rotated (or a double-submit raced) | `revoked_at` on that row |
| All sessions dropped unexpectedly | a password change or reset ran | `revoked_at` timestamps cluster at that moment |
| 401 `Account not found or disabled` | user deleted, or `is_active=false` | `SELECT is_active FROM users …` |
| Login 403 not 401 | password was correct, account disabled | that is the intended split (§7) |
| 409 on an email you think is free | `citext` — differs only by case | `SELECT email FROM users WHERE email = 'x@y.com'` |
| Registration 500 instead of 409 | `db.rollback()` missing before the raise | `auth_service.register` |
| `/auth/forgot-password` gives no `reset_token` | `DEBUG` is not true, or the email has no account | `settings.debug`; unknown emails never get a token |
| Reset 400 `Invalid or expired reset token` | already used, past 30 min, or wrong token | `used_at` / `expires_at` |
| Password rejected at 8+ chars | over 72 characters, or over 72 **bytes** | `details[]` names the field |
| `PATCH /users/me` blanked a field | client sent explicit `null` | `exclude_unset` treats `null` as "clear" |
| Tests pass, manual curl fails | different database — tests use `<db>_test` | `alembic current` on the dev DB |
| `pytest` wiped rows you were looking at | the test DB is truncated per test | you were probably reading the wrong DB |

---

## 11. Test map

[tests/test_auth.py](../tests/test_auth.py) · [tests/test_users.py](../tests/test_users.py) ·
fixtures in [tests/conftest.py](../tests/conftest.py)

| Test | Guards |
|---|---|
| `test_register_returns_user_and_tokens` | 201, token pair, `expires_in`, no password field leaks |
| `test_duplicate_email_is_case_insensitive_conflict` | `citext` + 409 |
| `test_short_password_is_a_validation_error` | 400 envelope with `details[0].field` |
| `test_login_and_me` | login → bearer → `/auth/me` |
| `test_login_with_wrong_password_is_401` | no enumeration via status |
| `test_me_without_token_is_401_envelope` | exact 401 body |
| `test_refresh_rotates_and_burns_the_old_token` | rotation, and reuse is 401 |
| `test_logout_revokes_the_refresh_token` | revocation |
| `test_forgot_password_never_reveals_…` | identical response for known/unknown |
| `test_reset_password_flow` | reset works, old password dies, sessions die, token is single-use |
| `test_expired_reset_token_is_rejected` | `expires_at` honoured |
| `test_refresh_tokens_are_stored_hashed` | raw token absent from the table, 64-char hashes |
| `test_deleting_the_account_leaves_no_orphan_tokens` | FK cascade |
| `test_patch_me_only_touches_supplied_fields` | `exclude_unset` |
| `test_change_password_signs_out_every_session` | global revoke |
| `test_change_password_with_wrong_current_is_401` | current-password check |

### Test harness facts

- Tests run against a **separate** `globetrotter_test` database, created on first
  run. `conftest.py` rewrites `DATABASE_URL` in `os.environ` *before* anything
  imports `Settings` — that is why the imports there sit below code and carry
  `# noqa: E402`.
- Schema is built with `Base.metadata.create_all`, **not** Alembic. Faster, but it
  means a broken migration will not fail the suite. Migrations are verified
  separately with an `upgrade head` → `downgrade base` → `upgrade head` roundtrip.
- Every table is `TRUNCATE … CASCADE`d before each test.
- `DEBUG=true` is forced so `/auth/forgot-password` hands back the reset token.
  Side effect: SQLAlchemy `echo` is on, so failures print a lot of SQL.
- One event loop for the whole session (`asyncio_default_*_loop_scope = "session"`)
  so the asyncpg pool survives between tests. Set these back to `function` and
  you get "attached to a different loop" errors.

---

## 12. Deferred out of this phase

| Item | Where it goes |
|---|---|
| `/users/me/saved-destinations` | Phase 3 — needs the `cities` table |
| Real email delivery for password reset | whenever an SMTP/provider credential exists; marked with a `ponytail:` comment in `routes/auth.py` |
| Rate limiting on `/auth/login` and `/auth/forgot-password` (5/min) | Phase 7 |
| Avatar **upload** (the column exists, the endpoint does not) | Phase 4, alongside trip cover upload |
| Anything that consumes `require_admin` | Phase 6 |
