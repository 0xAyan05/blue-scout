import { createServerFn } from "@tanstack/react-start";

export const login = createServerFn({ method: "POST" }).handler(async () => {
  return { ok: true as const };
});

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  return { ok: true as const };
});

export const checkAuth = createServerFn({ method: "GET" }).handler(async () => {
  return { authenticated: true as const };
});
