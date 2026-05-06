import { apiRequest } from "./client";
import type {
  CompleteUpsolvingProblemResponse,
  CompleteUpsolvingProblemsResponse,
  SyncUpsolvingResponse,
  UpsolvingContestDetailResponse,
  UpsolvingOverviewResponse,
} from "../../types/upsolving";

export function getUpsolving() {
  return apiRequest<UpsolvingOverviewResponse>("/api/upsolving");
}

export function getUpsolvingContest(contestId: number) {
  return apiRequest<UpsolvingContestDetailResponse>(`/api/upsolving/${contestId}`);
}

export function syncUpsolving(force = false) {
  return apiRequest<SyncUpsolvingResponse>("/api/upsolving/sync", {
    method: "POST",
    body: JSON.stringify({ force }),
  });
}

export function completeUpsolvingProblem(problemId: number) {
  return apiRequest<CompleteUpsolvingProblemResponse>(
    `/api/upsolving/problems/${problemId}/complete`,
    {
      method: "POST",
    },
  );
}

export function completeUpsolvingProblems(problemIds: readonly number[]) {
  return apiRequest<CompleteUpsolvingProblemsResponse>(
    "/api/upsolving/problems/complete",
    {
      method: "POST",
      body: JSON.stringify({ problemIds }),
    },
  );
}
