import type { User } from "@/types";
import { apiFetch } from "./client";

export interface ApiUser {
  id: string;
  first_name: string;
  last_name: string;
  name: string; // derived server-side from first + last
  email: string;
  phone: string | null;
  avatar_url: string | null;
  city: string | null;
  country: string | null;
  additional_info: string | null;
  language: string;
  role: "USER" | "ADMIN";
  is_active: boolean;
  created_at: string;
}

/**
 * Sign-up asks for these four and nothing else. The API also accepts `phone`,
 * `city`, `country` and `additional_info` - all optional - but the form no longer
 * collects them: they are edited in Settings, which is a screen that saves.
 */
export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export function toUser(user: ApiUser): User {
  return {
    id: user.id,
    name: user.name,
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
    phone: user.phone ?? undefined,
    avatarUrl: user.avatar_url ?? undefined,
    // `location` is the UI's single display string for where someone is based.
    location: [user.city, user.country].filter(Boolean).join(", ") || undefined,
    bio: user.additional_info ?? undefined,
    role: user.role === "ADMIN" ? "admin" : "user",
    memberSince: user.created_at,
    preferences: {
      currency: "USD",
      homeCity: user.city ?? undefined,
      language: user.language,
      travelStyle: [],
      emailNotifications: true,
      publicProfile: false,
    },
    savedCityIds: [],
  };
}

export async function login(email: string, password: string): Promise<User> {
  const user = await apiFetch<ApiUser>(
    "/api/v1/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    },
    { retryOnUnauthorized: false }
  );
  return toUser(user);
}

export async function register(input: RegisterInput): Promise<User> {
  const user = await apiFetch<ApiUser>(
    "/api/v1/auth/register",
    {
      method: "POST",
      body: JSON.stringify({
        first_name: input.firstName,
        last_name: input.lastName,
        email: input.email,
        password: input.password,
      }),
    },
    { retryOnUnauthorized: false }
  );
  return toUser(user);
}

/**
 * Always succeeds, whether or not the account exists - the API refuses to leak
 * which emails are registered.
 *
 * `resetToken` comes back only when the API runs with DEBUG=true, because no
 * mailer is wired up (see the ponytail note in routes/auth.py). Without it the
 * reset flow is untestable, so the form shows it as an explicitly-labelled dev
 * shortcut. In production the field is absent and the UI just says "check your
 * inbox".
 */
export async function forgotPassword(email: string): Promise<{ resetToken?: string }> {
  const data = await apiFetch<{ message: string; reset_token?: string }>(
    "/api/v1/auth/forgot-password",
    {
      method: "POST",
      body: JSON.stringify({ email }),
    },
    { retryOnUnauthorized: false }
  );
  return { resetToken: data.reset_token };
}

/** Single-use, and it signs out every existing session. */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await apiFetch<{ message: string }>(
    "/api/v1/auth/reset-password",
    {
      method: "POST",
      body: JSON.stringify({ token, new_password: newPassword }),
    },
    { retryOnUnauthorized: false }
  );
}

export async function logout(): Promise<void> {
  await apiFetch<{ revoked: boolean }>(
    "/api/v1/auth/logout",
    { method: "POST" },
    { retryOnUnauthorized: false }
  );
}

export async function getCurrentUser(): Promise<User> {
  const user = await apiFetch<ApiUser>("/api/v1/auth/me");
  return toUser(user);
}
