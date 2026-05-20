import { createMiddleware } from "@tanstack/react-start";

export const requirePassword = createMiddleware({ type: "function" }).server(
  async ({ next }) => next(),
);
