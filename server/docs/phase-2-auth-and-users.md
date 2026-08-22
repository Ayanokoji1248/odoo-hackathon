# Phase 2 — Auth & users

> Superseded for runtime auth by
> [phase-4-production-auth.md](phase-4-production-auth.md). This doc is kept as
> history for the temporary one-cookie implementation.

Cookie-based sessions, password reset, profile management, and the dependency
every protected route hangs off.

> **Revised after Phase 3.** This phase originally shipped a JWT access token +
> rotating opaque refresh token + signed double-submit CSRF token — three tokens,
> three cookies, a middleware, and a client-side refresh interceptor. It was
> replaced with **one opaque session token in one httpOnly cookie**.
>
> The reasoning is in §2. Short version: the JWT's only advantage is skipping a
> DB read, and `get_current_user` had to read the user row anyway to check
> `is_active` — so statelessness bought nothing and cost revocability. And
> `SameSite=lax` already blocks the cross-site POST that the CSRF token existed
> to catch. Both were deleted along with `pyjwt`.

---

## 1. Files

| File | Responsibility |
|---|---|
| [app/core/security.py](../app/core/security.py) | bcrypt hash/verify, opaque token generation, sha256 token hashing |
| [app/core/cookies.py](../app/core/cookies.py) | the cookie name and its set/clear helpers |
| [app/models/user.py](../app/models/user.py) | `User`, `UserSession`, `PasswordResetToken`, `UserRole` |
| [app/schemas/auth.py](../app/schemas/auth.py) | request bodies only — no token ever appears in a response model |
| [app/services/auth_service.py](../app/services/auth_service.py) | every write: register, login, logout, reset, change-password |
| [app/services/user_service.py](../app/services/user_service.py) | profile update, account delete, saved destinations |
| [app/deps.py](../app/deps.py) | `get_current_user`, `CurrentUser`, `AdminUser` |
| [app/api/v1/routes/auth.py](../app/api/v1/routes/auth.py) | `/auth/*` |
| [app/api/v1/routes/users.py](../app/api/v1/routes/users.py) | `/users/me*` |
| [alembic/versions/dae7f6738b4c_…](../alembic/versions/dae7f6738b4c_auth_users_refresh_and_reset_tokens.py) | original tables + `citext` |
| [alembic/versions/7f1c4e0b93aa_…](../alembic/versions/7f1c4e0b93aa_replace_refresh_tokens_with_sessions.py) | drops `refresh_tokens`, creates `sessions` |
| [tests/test_auth.py](../tests/test_auth.py) · [tests/test_users.py](../tests/test_users.py) | route-level coverage |

---

## 2. Why one token

The three-token design was correct for a stateless API. This is not one.

```python
# app/deps.py — the line that decided it
user = await db.get(User, row.user_id)
```

Every authenticated request loads the user row, because `is_active` has to be
checked on each call — a disabled account must stop working immediately, not
whenever its token happens to expire. Once you are paying that read, a
self-validating JWT saves nothing. It only takes away the ability to revoke.

So the token became opaque, and validating it became a lookup:

| | old (3 tokens) | now (1 token) |
|---|---|---|
| DB reads per request | 1 (`users`) | 2 (`sessions`, `users`) |
| Logout kills the credential | no — access JWT valid until expiry | **yes, immediately** |
| Client-side refresh loop needed | yes | no |
| Cookies | 3 | 1 |
| Deps | `pyjwt` | — |

The extra read is one index hit on `uq_sessions_token_hash`. In exchange, the
15-minute access window that existed *only* to bound un-revokable damage is no
longer needed, and the frontend loses its most error-prone component — the
401 → refresh → retry interceptor.

**When to reverse this:** multiple services validating the same token without
sharing a database, or a read volume where one extra indexed lookup per request
actually shows up in a profile. Neither is true here.

---

## 3. Data model

### `users`

`email` is `citext` — case-insensitive uniqueness enforced by the DB, not by
`lower()` calls sprinkled through the service layer. `uq_users_email` is the
**only** race-free duplicate check; `register` catches `IntegrityError` and maps
it to 409 rather than doing a select-then-insert.

`is_active` gates login *and* every authenticated request. `role` is a Postgres
enum (`user_role`), which is why `downgrade()` in the first migration drops the
type explicitly — `drop_table` does not.

### `sessions`

| Column | Note |
|---|---|
| `user_id` | FK `ondelete=CASCADE`, indexed |
| `token_hash` | sha256 hex, `unique` — the lookup key |
| `expires_at` | `timestamptz`, checked on every request |

One row per logged-in browser. There is no `revoked_at` flag: **revoking is a
`DELETE`**. A flag would be a second thing to remember to check, and the row has
no value once dead.

`expires_at` is fixed at creation (`now() + SESSION_EXPIRE_DAYS`) and does not
slide on use. A 7-day-old session ends even for an active user; they log in
again. Sliding expiry is a deliberate omission, not an oversight.

### `password_reset_tokens`

Same shape, plus `used_at` for single-use enforcement. 30-minute TTL.

### Token forms

| | session | reset |
|---|---|---|
| Form | `secrets.token_urlsafe(32)` | `secrets.token_urlsafe(32)` |
| Stored as | sha256 hex (64 chars) | sha256 hex (64 chars) |
| Lifetime | 7 days | 30 min |
| Transport | `gt_session` cookie | JSON body / log line |
| Revocable | yes, `DELETE` | yes, `used_at` |

**Why sha256 and not bcrypt:** these are already 256 bits of entropy. bcrypt's
work factor exists to slow brute-forcing of *low*-entropy secrets like passwords.
Applying it here would add a KDF to every single request for no security gain.
Passwords get bcrypt; tokens get sha256.

---

## 4. The cookie

One cookie, set by [`set_session_cookie`](../app/core/cookies.py):

| Name | Path | httpOnly | Max-Age | Holds |
|---|---|---|---|---|
| `gt_session` | `/` | **yes** | 7 days | the opaque session token |

Flags come from env, so both deployment topologies work without a code change:

| Env var | Local | Production (same-origin) |
|---|---|---|
| `COOKIE_SECURE` | `false` (no https on localhost) | `true` |
| `COOKIE_SAMESITE` | `lax` | `lax` |
| `COOKIE_DOMAIN` | unset | unset, or `.yourdomain.com` across subdomains |

`Settings` rejects `COOKIE_SAMESITE=none` without `COOKIE_SECURE=true` at import
— browsers silently drop that combination, which is a miserable thing to debug.

### Why there is no CSRF token

`SameSite=lax` instructs the browser not to attach the cookie to a cross-site
`POST`/`PUT`/`PATCH`/`DELETE`. That is precisely the attack a CSRF token defends
against, and it is enforced by the browser rather than by application code.
Default-on in Chrome since 80, Firefox 96, Safari 16.4.

**The one case where this stops holding** is `COOKIE_SAMESITE=none` — required
when the frontend is on a genuinely different registrable domain than the API.
`none` means "do send cross-site," which re-opens CSRF completely.

> If you ever set `COOKIE_SAMESITE=none`, you must add CSRF protection back.
> The deleted version was never committed, so here is the shape of it: mint a
> `<random>.<hmac_sha256(random, secret)[:32]>` token, set it in a **non**-httpOnly
> cookie alongside the session, and reject unsafe methods in a middleware unless
> the `x-csrf-token` header matches the cookie *and* the signature verifies.
> The signature is not decoration — a plain double-submit is forgeable by an
> attacker who can set a cookie on a sibling subdomain.
>
> The better fix is usually to avoid needing `none`: proxy `/api/*` from the
> frontend host to the backend, and the deployment becomes same-origin.

### `clear_session_cookie`

`path` and `domain` must match what `set_cookie` used, or the browser keeps the
old cookie and logout silently does nothing. This is the single most common
cookie bug — if logout stops working after a deployment change, check here first.

Clearing the cookie is only half of logout. The row is deleted too, so a copied
token is dead even though the attacker never received the `Set-Cookie`.

---

## 5. Endpoints

Every response uses the `ApiResponse` envelope from `app/core/schemas.py`.

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| POST | `/auth/register` | — | `name`, `email`, `password` | 201 `UserRead` + `Set-Cookie` |
| POST | `/auth/login` | — | `email`, `password` | 200 `UserRead` + `Set-Cookie` |
| POST | `/auth/logout` | cookie (optional) | — | 200 `{ revoked: true }`, cookie cleared |
| POST | `/auth/forgot-password` | — | `email` | 200 `{ message }` (+ `reset_token` when `DEBUG`) |
| POST | `/auth/reset-password` | — | `token`, `new_password` | 200 `{ message }`, cookie cleared |
| GET | `/auth/me` | cookie | — | 200 `UserRead` |
| PATCH | `/users/me` | cookie | any of `name`, `avatar_url`, `language` | 200 `UserRead` |
| PATCH | `/users/me/password` | cookie | `current_password`, `new_password` | 200 `{ message }`, cookie cleared |
| DELETE | `/users/me` | cookie | — | 200 `{ deleted: true }` |

`/auth/register` and `/auth/login` return **only the user**. There is no
`csrf_token` and no `expires_in` in the body any more — the session token is in
the cookie and nothing else needs to travel.

`Password` in [schemas/auth.py](../app/schemas/auth.py) caps at 72 bytes because
bcrypt hard-errors past that. Capping in the schema makes it a 400 with a field
name instead of a 500.

---

## 6. `get_current_user`

```
gt_session cookie present?              → else 401 "Not signed in"
sessions row WHERE token_hash = sha256  → else 401 "Session expired or revoked"
row.expires_at > now()                  → else 401 "Session expired or revoked"
users row exists AND is_active          → else 401 "Account not found or disabled"
```

Two queries. The same message covers "no such session" and "expired" on purpose —
distinguishing them tells an attacker whether a guessed token ever existed.

Exposed as type aliases, so a protected route is just a parameter:

```python
async def me(user: CurrentUser) -> ApiResponse[UserRead]: ...
async def wipe(user: AdminUser) -> ...:                    # 403 if role != ADMIN
```

There is **no `Authorization: Bearer` fallback.** The old one existed because a
JWT was easy to paste into curl; an opaque session token is not something you can
mint by hand. `/docs` still works — POST `/auth/login` from the Swagger page and
the browser holds the cookie for every later call. For curl, use a cookie jar
(§10).

---

## 7. Flows

### Register

```
POST /auth/register
  → INSERT users            (IntegrityError → 409 CONFLICT)
  → INSERT sessions         (raw token returned, hash stored)
  → commit → Set-Cookie: gt_session → 201 { user }
```

The user is created **and signed in** by the same call. One round trip from
signup form to authenticated app.

### Login

```
POST /auth/login
  → SELECT users WHERE email = ?        (citext: case-insensitive)
  → bcrypt.checkpw                       → else 401 "Invalid email or password"
  → is_active                            → else 403
  → INSERT sessions → commit → Set-Cookie → 200 { user }
```

Wrong email and wrong password give the identical 401 message — no account
enumeration. A *disabled* account gives 403, which does leak existence; that is
accepted, because a user who has been disabled needs to be told that rather than
left retyping a correct password.

Each login inserts its own row. Signing in on a phone does not disturb the
laptop, and logging out of one leaves the other alone
(`test_each_login_is_its_own_session`).

### Logout

```
POST /auth/logout
  → DELETE FROM sessions WHERE token_hash = ?   (idempotent)
  → clear cookie → 200
```

Requires no valid session, on purpose: the whole point of logging out is that the
session may already be gone. Calling it twice, or with no cookie at all, is 200.

### Password reset

```
POST /auth/forgot-password  → always 200, same message either way
  → account exists? INSERT password_reset_tokens (30 min)
  → DEBUG: token in the body. else: token in the log line.

POST /auth/reset-password
  → SELECT by hash → unused? unexpired?  → else 400
  → UPDATE users.password_hash
  → SET used_at
  → DELETE FROM sessions WHERE user_id = ?     ← every session, everywhere
  → clear this browser's cookie → 200
```

`PATCH /users/me/password` does the same `_delete_all_sessions` **and** clears the
caller's cookie, so changing your password signs out every device including the
one you did it from. That is the intended behaviour: it is the only sane response
to "my password may have leaked."

This is the concrete thing the old design could not do. Deleting session rows
ends those sessions *now*, where revoking refresh tokens still left every issued
access JWT valid for up to 15 more minutes.

---

## 8. Invariants

Each of these has a test; break one and something in `tests/test_auth.py` fails.

1. No session token appears in any response body — only in `Set-Cookie`.
2. Passwords are bcrypt, never reversible, never echoed.
3. Raw session and reset tokens are never persisted — only sha256 hex.
4. `gt_session` is always `httpOnly` and always `SameSite=lax` (or stricter).
5. Wrong email and wrong password are indistinguishable.
6. `/auth/forgot-password` answers identically for existing and unknown accounts.
7. A reset token works exactly once.
8. Any credential change deletes **every** session for that user.
9. Logout deletes the row, not just the cookie — a copied token stops working.
10. Deleting a user leaves no orphan session or reset rows (FK `CASCADE`).
11. Sessions are per-login and independent.

---

## 9. Errors

| Status | Code | Message | Cause |
|---|---|---|---|
| 401 | `UNAUTHORIZED` | `Not signed in` | no `gt_session` cookie |
| 401 | `UNAUTHORIZED` | `Session expired or revoked` | unknown token, or `expires_at` passed |
| 401 | `UNAUTHORIZED` | `Account not found or disabled` | session valid, user gone or `is_active=false` |
| 401 | `UNAUTHORIZED` | `Invalid email or password` | login failure (either field) |
| 401 | `UNAUTHORIZED` | `Current password is incorrect` | `PATCH /users/me/password` |
| 403 | `FORBIDDEN` | `This account has been disabled` | login on `is_active=false` |
| 403 | `FORBIDDEN` | `Admin access required` | `AdminUser` on a non-admin |
| 409 | `CONFLICT` | `An account with that email already exists` | duplicate email, any casing |
| 400 | `VALIDATION_ERROR` | `Invalid or expired reset token` | unknown, used, or expired |
| 400 | `VALIDATION_ERROR` | per-field `details` | pydantic (short password, bad email) |

---

## 10. Debugging

Drive the API with a cookie jar — the session cookie is httpOnly, so this is the
only way from the shell:

```bash
curl -sc jar.txt -X POST localhost:8000/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"demo@globetrotter.app","password":"demo12345"}'

curl -sb jar.txt localhost:8000/api/v1/auth/me

# no CSRF header — a mutation needs nothing but the cookie
curl -sb jar.txt -X PATCH localhost:8000/api/v1/users/me \
  -H 'content-type: application/json' -d '{"language":"fr"}'
```

Inspect a user's live sessions:

```sql
SELECT id, created_at, expires_at, expires_at > now() AS live
FROM sessions WHERE user_id = '<uuid>' ORDER BY created_at DESC;
```

Turn a raw cookie value into the hash you can grep for:

```bash
./.venv/Scripts/python.exe -c "from app.core.security import hash_token;import sys;print(hash_token(sys.argv[1]))" <raw>
```

Orphan check (must be 0):

```sql
SELECT count(*) FROM sessions s LEFT JOIN users u ON u.id = s.user_id WHERE u.id IS NULL;
```

Expire a session on demand, to test the 401 path:

```sql
UPDATE sessions SET expires_at = now() - interval '1 minute' WHERE user_id = '<uuid>';
```

### Symptom → cause → check

| Symptom | Likely cause | Check |
|---|---|---|
| Every request 401 `Not signed in` from the browser | cookie never stored or never sent | `credentials: "include"` on **every** fetch; `COOKIE_SECURE=true` over plain http means the browser drops it |
| Works in curl, 401 in the browser | CORS | `allow_credentials=True` **and** the exact origin in `CORS_ORIGINS` — a wildcard origin is invalid with credentials |
| Cookie visible in devtools but still 401 | it is a stale token whose row is gone | look up its `hash_token` in `sessions`; a password change deletes all rows |
| Logout returns 200 but the user stays signed in | `delete_cookie` path/domain mismatch | they must match `set_cookie` exactly — see [cookies.py](../app/core/cookies.py) |
| 401 immediately after a password change | correct and intended | every session was deleted; sign in again |
| 403 `This account has been disabled` | `users.is_active = false` | `UPDATE users SET is_active = true WHERE email = …` |
| `/auth/forgot-password` gives no token | `DEBUG` is not true | it is logged instead — `log.info("password reset token issued for …")` |
| 409 on an email that "isn't taken" | `citext` — casing does not create a new account | `SELECT email FROM users WHERE email = 'That@Example.com'` |
| Cookie missing entirely in production | `SameSite=none` without `Secure` | `Settings` refuses to boot on that combination — read the startup error |

---

## 11. Tests

`tests/test_auth.py` (17) + `tests/test_users.py` (3), against an isolated
`globetrotter_test` database.

| Test | Guards |
|---|---|
| `test_register_returns_the_user_and_nothing_else` | 201, no token in the body |
| `test_session_cookie_carries_the_right_flags` | httpOnly, SameSite, path |
| `test_duplicate_email_is_case_insensitive_conflict` | `citext` + 409 |
| `test_short_password_is_a_validation_error` | 400 with a field name |
| `test_the_cookie_alone_authenticates_every_method` | GET **and** PATCH need no headers |
| `test_login_with_wrong_password_is_401` | no enumeration |
| `test_me_without_a_cookie_is_401` | exact error envelope |
| `test_an_unknown_session_token_is_401` | a forged token is not accepted |
| `test_an_expired_session_is_401` | `expires_at` is enforced |
| `test_each_login_is_its_own_session` | per-login rows, independent logout |
| `test_logout_deletes_the_row_and_clears_the_cookie` | revocation is real, not cosmetic |
| `test_logout_without_a_cookie_is_still_200` | idempotent |
| `test_forgot_password_never_reveals_…` | identical answers |
| `test_reset_password_flow` | old password dead, all sessions dead, token single-use |
| `test_expired_reset_token_is_rejected` | TTL |
| `test_session_tokens_are_stored_hashed` | raw token absent from the table |
| `test_deleting_the_account_leaves_no_orphan_sessions` | FK CASCADE |
| `test_change_password_signs_out_every_session` | credential change → full sign-out |

Fixtures in [tests/conftest.py](../tests/conftest.py):

- `auth` — registers a user; the session cookie is left in `client`'s jar, so
  every later call through `client` is authenticated with **no headers at all**.
  It returns the `UserRead` dict.
- `make_client` — a fresh client with an explicit cookie jar, for tests that need
  a second browser or a replayed dead token.
- `_clean_tables` — `TRUNCATE … CASCADE` between tests.

---

## 12. Deliberately not built

| Thing | Why |
|---|---|
| Sliding session expiry | 7 fixed days is fine; renewal-on-use is a write per request |
| A "your sessions" management screen | nothing consumes it; `user_agent` was dropped with the old table |
| Expired-row cleanup job | `sessions` and `password_reset_tokens` grow slowly. A periodic `DELETE WHERE expires_at < now()` is the fix when it matters |
| CSRF token | `SameSite=lax` covers it — see §4, including exactly when this reverses |
| Bearer-header auth | opaque tokens cannot be hand-minted; use a cookie jar |
| Mailer | no SMTP credential. Token is returned in `DEBUG`, logged otherwise |
| Email verification, OAuth, 2FA, rate limiting | out of scope for the hackathon build |
