import { ApiError } from "./errors";
import { resolveApiBaseUrl } from "../runtime";

type JsonRecord = Record<string, unknown>;

type ApiErrorShape = {
  error?: {
    tag?: string;
    message?: string;
  };
};

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${resolveApiBaseUrl()}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    ...init,
  });

  const isJson = response.headers.get("content-type")?.includes("application/json") ?? false;
  const payload = isJson ? ((await response.json()) as T & ApiErrorShape & JsonRecord) : null;

  if (!response.ok) {
    throw new ApiError({
      status: response.status,
      tag: payload?.error?.tag ?? null,
      message: payload?.error?.message ?? `Request failed with status ${response.status}.`,
    });
  }

  return payload as T;
}
