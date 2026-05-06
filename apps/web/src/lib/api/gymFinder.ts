import { apiRequest } from "./client";
import type { GymFinderResponse } from "../../types/gymFinder";

export function getGymFinderResults() {
  return apiRequest<GymFinderResponse>("/api/gym-finder");
}
