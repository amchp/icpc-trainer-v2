import { apiRequest } from "./client";
import type {
  ReplaceRosterRequest,
  RosterResponse,
  SyncRosterRequest,
  SyncRosterResponse,
} from "../../types/roster";

export function getFriends() {
  return apiRequest<RosterResponse>("/api/friends");
}

export function replaceFriends(input: ReplaceRosterRequest) {
  return apiRequest<RosterResponse>("/api/friends", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function syncFriends(input: SyncRosterRequest = { force: false }) {
  return apiRequest<SyncRosterResponse>("/api/friends/sync", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
