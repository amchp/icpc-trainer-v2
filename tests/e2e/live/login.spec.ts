import { expect, test } from "@playwright/test";

import { getLiveEnv } from "./helpers/env";
import { selectors } from "./helpers/selectors";
import { waitForAuthenticatedShell, waitForNoVisibleText } from "./helpers/wait";

test("logs in with signed Codeforces credentials", async ({ page, request }) => {
  const liveEnv = getLiveEnv();

  await request.post(`${liveEnv.apiBaseUrl}/api/session/logout`);
  await page.goto("/");

  await expect(page.getByTestId(selectors.loginForm)).toBeVisible();
  await expect(page.getByTestId(selectors.loginHandleInput)).toBeVisible();
  await expect(page.getByTestId(selectors.loginApiKeyInput)).toBeVisible();
  await expect(page.getByTestId(selectors.loginApiSecretInput)).toBeVisible();

  await page.getByTestId(selectors.loginHandleInput).fill(liveEnv.handle);
  await page.getByTestId(selectors.loginApiKeyInput).fill(liveEnv.apiKey);
  await page.getByTestId(selectors.loginApiSecretInput).fill(liveEnv.apiSecret);
  await page.getByTestId(selectors.loginSubmit).click();

  await waitForAuthenticatedShell(page, liveEnv.handle);
  await waitForNoVisibleText(page, /login failed|invalid signed credentials|no active session/i);
});
