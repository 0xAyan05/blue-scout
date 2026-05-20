import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/lib/domain-selector";

export function jsonError(
  error: unknown,
  fallbackMessage = "Unexpected server error.",
  fallbackCode = "INTERNAL_ERROR",
) {
  console.error(error);

  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        ...(error.details ? { details: error.details } : {}),
      },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Request validation failed.",
        code: "VALIDATION_ERROR",
        details: error.flatten(),
      },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      error: fallbackMessage,
      code: fallbackCode,
    },
    { status: 500 },
  );
}
