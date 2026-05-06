export const selectors = {
  appShell: "app-shell",
  currentSessionHandle: "current-session-handle",
  loginForm: "login-form",
  loginHandleInput: "login-handle-input",
  loginApiKeyInput: "login-api-key-input",
  loginApiSecretInput: "login-api-secret-input",
  loginSubmit: "login-submit",
  navGymFinder: "nav-gym-finder",
  navTeam: "nav-team",
  navUpsolving: "nav-upsolving",
  gymFinderPage: "gym-finder-page",
  gymFinderResults: "gym-finder-results",
  gymFinderResultCard: "gym-finder-result-card",
  gymFinderContestLink: "gym-finder-contest-link",
  teamPage: "team-page",
  teamAddInput: "team-add-input",
  teamAddSubmit: "team-add-submit",
  upsolvingPage: "upsolving-page",
  upsolvingTabGyms: "upsolving-tab-gyms",
  upsolvingTabContests: "upsolving-tab-contests",
  upsolvingProblemTable: "upsolving-problem-table",
} as const;

export function teamHandleChipTestId(handle: string) {
  return `team-handle-chip-${handle.toLowerCase()}`;
}
