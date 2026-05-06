export class ApiError extends Error {
  readonly status: number;
  readonly tag: string | null;

  constructor(input: { message: string; status: number; tag?: string | null }) {
    super(input.message);
    this.name = "ApiError";
    this.status = input.status;
    this.tag = input.tag ?? null;
  }
}

export function getErrorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return fallback;
}

export function getErrorDetails(error: unknown): string | undefined {
  if (error instanceof ApiError) {
    const parts = [`HTTP ${error.status}`];
    if (error.tag) {
      parts.push(error.tag);
    }
    return parts.join(" · ");
  }

  return undefined;
}
