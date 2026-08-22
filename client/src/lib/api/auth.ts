import type { User } from "@/types";
import { apiFetch } from "./client";

interface ApiUser {
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

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  city?: string;
  country?: string;
  additionalInfo?: string;
}

function toUser(user: ApiUser): User {
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
  // Only send optional fields that were actually filled in. An empty string
  // would be stored as one - and `phone` is UNIQUE, so a blank would collide
  // with the next blank signup.
  const user = await apiFetch<ApiUser>(
    "/api/v1/auth/register",
    {
      method: "POST",
      body: JSON.stringify({
        first_name: input.firstName,
        last_name: input.lastName,
        email: input.email,
        password: input.password,
        ...(input.phone ? { phone: input.phone } : {}),
        ...(input.city ? { city: input.city } : {}),
        ...(input.country ? { country: input.country } : {}),
        ...(input.additionalInfo ? { additional_info: input.additionalInfo } : {}),
      }),
    },
    { retryOnUnauthorized: false }
  );
  return toUser(user);
}

export async function forgotPassword(email: string): Promise<void> {
  await apiFetch<{ message: string }>(
    "/api/v1/auth/forgot-password",
    {
      method: "POST",
      body: JSON.stringify({ email }),
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
