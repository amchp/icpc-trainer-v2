import { expect, test } from "@playwright/test";

import { getLiveEnv } from "./helpers/env";
import { selectors } from "./helpers/selectors";
import { waitForAuthenticatedShell } from "./helpers/wait";

test("logs in once and writes storage state", async ({ page, context }) => {
  const liveEnv = getLiveEnv();

  await page.goto("/");
  await expect(page.getByTestId(selectors.loginForm)).toBeVisible();

  await page.getByTestId(selectors.loginHandleInput).fill(liveEnv.handle);
  await page.getByTestId(selectors.loginApiKeyInput).fill(liveEnv.apiKey);
  await page.getByTestId(selectors.loginApiSecretInput).fill(liveEnv.apiSecret);
  await page.getByTestId(selectors.loginSubmit).click();

  await waitForAuthenticatedShell(page, liveEnv.handle);
  await context.storageState({ path: liveEnv.storageStatePath });
});
