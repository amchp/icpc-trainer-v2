import { apiRequest } from "./client";
import type { LoginInput, LogoutResponse, SessionResponse } from "../../types/session";

export function getSession() {
  return apiRequest<SessionResponse>("/api/session");
}

export function loginSession(input: LoginInput) {
  return apiRequest<SessionResponse>("/api/session/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function logoutSession() {
  return apiRequest<LogoutResponse>("/api/session/logout", {
    method: "POST",
  });
}
