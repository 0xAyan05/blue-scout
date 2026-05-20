import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import {
  checkPassword,
  createSessionCookie,
  clearSessionCookie,
  verifySessionCookieHeader,
} from "./auth.server";

export const login = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ password: z.string().min(1).max(500) }).parse(input))
  .handler(async ({ data }) => {
    if (!checkPassword(data.password)) {
      return { ok: false as const, error: "Incorrect password" };
    }
    setResponseHeader("set-cookie", createSessionCookie());
    return { ok: true as const };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  setResponseHeader("set-cookie", clearSessionCookie());
  return { ok: true };
});

export const checkAuth = createServerFn({ method: "GET" }).handler(async () => {
  const cookie = getRequestHeader("cookie") ?? null;
  return { authenticated: verifySessionCookieHeader(cookie) };
});
