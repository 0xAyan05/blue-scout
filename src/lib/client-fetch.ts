"use client";

export async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const resolvedInput =
    typeof input === "string"
      ? `${input}${input.includes("?") ? "&" : "?"}__ts=${Date.now()}`
      : input instanceof URL
        ? new URL(
            `${input.toString()}${input.search ? "&" : "?"}__ts=${Date.now()}`,
          )
        : input;

  const response = await fetch(resolvedInput, {
    cache: "no-store",
    ...init,
  });
  if (!response.ok) {
    let message = "Request failed";
    try {
      const payload = (await response.json()) as { error?: string };
      message = payload.error ?? message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}
