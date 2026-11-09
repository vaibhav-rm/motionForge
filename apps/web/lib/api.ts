import { NextResponse } from "next/server";
import { z } from "zod";

export function jsonOk<T>(data: T, init?: number | ResponseInit) {
  const responseInit =
    typeof init === "number" ? { status: init } : init;
  return NextResponse.json({ ok: true, data }, responseInit);
}

export function jsonError(
  message: string,
  status = 400,
  code = "BAD_REQUEST",
  details?: unknown,
) {
  return NextResponse.json(
    { ok: false, error: { message, code, details } },
    { status },
  );
}

export async function readJson<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      ok: false,
      response: jsonError("Request body must be valid JSON.", 400, "INVALID_JSON"),
    };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      response: jsonError(
        "Invalid request.",
        422,
        "VALIDATION_ERROR",
        parsed.error.flatten(),
      ),
    };
  }
  return { ok: true, data: parsed.data };
}

export function handleApiError(error: unknown): NextResponse {
  if (error && typeof error === "object" && "status" in error) {
    const e = error as { message?: string; status?: number; code?: string };
    return jsonError(e.message ?? "Error", e.status ?? 500, e.code ?? "ERROR");
  }
  const message = error instanceof Error ? error.message : "Internal error";
  console.error("[api]", error);
  return jsonError(message, 500, "INTERNAL_ERROR");
}
