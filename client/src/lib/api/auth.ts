import { mockUser } from "@/data/mock/users";
import type { User } from "@/types";
import { delay } from "./client";

export async function login(email: string, password: string): Promise<User> {
  void password; // mock: credentials aren't validated
  return delay({ ...mockUser, email: email || mockUser.email }, 400);
}

export async function getCurrentUser(): Promise<User> {
  return delay(mockUser);
}
