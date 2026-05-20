import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { verifySessionCookieHeader } from "./auth.server";

export const requirePassword = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const cookie = getRequestHeader("cookie") ?? null;
    if (!verifySessionCookieHeader(cookie)) {
      throw new Response("Unauthorized", { status: 401 });
    }
    return next();
  }
);
