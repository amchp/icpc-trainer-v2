import { apiRequest } from "./client";
import type {
  ReplaceRosterRequest,
  RosterResponse,
  SyncRosterRequest,
  SyncRosterResponse,
} from "../../types/roster";

export function getTeam() {
  return apiRequest<RosterResponse>("/api/team");
}

export function replaceTeam(input: ReplaceRosterRequest) {
  return apiRequest<RosterResponse>("/api/team", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function syncTeam(input: SyncRosterRequest = { force: false }) {
  return apiRequest<SyncRosterResponse>("/api/team/sync", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
