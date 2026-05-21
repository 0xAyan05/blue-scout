import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/lib/domain-selector";

function formatFieldPath(path: Array<string | number>) {
  if (path.length === 0) return "request";

  return path.reduce((acc, segment) => {
    if (typeof segment === "number") {
      return `${acc}[${segment}]`;
    }

    return acc ? `${acc}.${segment}` : segment;
  }, "");
}

function formatZodIssue(issue: ZodError["issues"][number]) {
  const field = formatFieldPath(issue.path);

  switch (issue.code) {
    case "invalid_type":
      if (issue.received === "undefined") {
        return `Missing required field: ${field}.`;
      }
      return `Invalid field: ${field} must be ${issue.expected}, received ${issue.received}.`;
    case "too_small":
      if (issue.type === "array") {
        return `Invalid field: ${field} must contain at least ${issue.minimum} item${issue.minimum === 1 ? "" : "s"}.`;
      }
      if (issue.type === "string") {
        return `Missing required field: ${field}.`;
      }
      return `Invalid field: ${field} must be at least ${issue.minimum}.`;
    case "too_big":
      if (issue.type === "array") {
        return `Invalid field: ${field} must contain no more than ${issue.maximum} items.`;
      }
      return `Invalid field: ${field} must be no more than ${issue.maximum}.`;
    case "invalid_string":
      if (issue.validation === "url") {
        return `Invalid field: ${field} must be a valid URL.`;
      }
      return `Invalid field: ${field} is not in a valid format.`;
    case "invalid_enum_value":
      return `Invalid field: ${field} must be one of ${issue.options.join(", ")}.`;
    case "custom":
      return issue.message || `Invalid field: ${field}.`;
    default:
      return issue.message || `Invalid field: ${field}.`;
  }
}

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
    const issues = error.issues.map(formatZodIssue);
    return NextResponse.json(
      {
        error: issues[0] ?? "Request validation failed.",
        code: "VALIDATION_ERROR",
        details: {
          fields: error.flatten().fieldErrors,
          form: error.flatten().formErrors,
          issues,
        },
      },
      { status: 400 },
    );
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json(
      {
        error: "Malformed request body.",
        code: "INVALID_JSON",
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
