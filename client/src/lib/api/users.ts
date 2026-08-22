import type { User } from "@/types";
import { apiFetch } from "./client";
import { toUser, type ApiUser } from "./auth";

/** bcrypt truncates past 72 bytes, so the API caps it there. Mirrored here so the
 *  form says so before the round trip. */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

export interface ProfileInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  city?: string;
  country?: string;
  /** `additional_info` server-side; the UI has always called it the bio. */
  bio?: string;
  language?: string;
}

/**
 * PATCH /users/me. Only the keys present are written.
 *
 * `""` clears a column rather than storing a blank — except `phone`, which is
 * UNIQUE: two accounts saving an empty phone would collide, so an empty one is
 * sent as `null`.
 */
export async function updateProfile(input: ProfileInput): Promise<User> {
  const body: Record<string, unknown> = {};
  if (input.firstName !== undefined) body.first_name = input.firstName;
  if (input.lastName !== undefined) body.last_name = input.lastName;
  if (input.phone !== undefined) body.phone = input.phone || null;
  if (input.city !== undefined) body.city = input.city;
  if (input.country !== undefined) body.country = input.country;
  if (input.bio !== undefined) body.additional_info = input.bio;
  if (input.language !== undefined) body.language = input.language;

  return toUser(
    await apiFetch<ApiUser>("/api/v1/users/me", {
      method: "PATCH",
      body: JSON.stringify(body),
    })
  );
}

/**
 * Signs out **every** device, this one included: the API deletes all sessions and
 * clears this browser's cookies. Callers must send the user to /login afterwards
 * rather than leaving a UI that looks signed in.
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  await apiFetch<{ message: string }>(
    "/api/v1/users/me/password",
    {
      method: "PATCH",
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    },
    // A wrong current password is a 401. Retrying it through /auth/refresh would
    // hide the real error behind a session that is perfectly fine.
    { retryOnUnauthorized: false }
  );
}

/** Irreversible. Trips, stops, activities and budget items go with the row. */
export async function deleteAccount(): Promise<void> {
  await apiFetch<{ deleted: boolean }>("/api/v1/users/me", { method: "DELETE" });
}
