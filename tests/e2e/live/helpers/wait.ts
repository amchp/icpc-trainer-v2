import { expect, type Locator, type Page } from "@playwright/test";

import { selectors } from "./selectors";

export async function waitForAuthenticatedShell(page: Page, expectedHandle?: string) {
  const authTimeoutMs = 75_000;

  await expect(page.getByTestId(selectors.appShell)).toBeVisible({ timeout: authTimeoutMs });
  await expect(page.getByTestId(selectors.loginForm)).toHaveCount(0, { timeout: authTimeoutMs });

  if (expectedHandle) {
    await expect(page.getByTestId(selectors.currentSessionHandle)).toContainText(expectedHandle, {
      ignoreCase: true,
      timeout: authTimeoutMs,
    });
  }
}

export async function waitForAnyVisible(locators: readonly Locator[]) {
  await expect
    .poll(
      async () => {
        for (const locator of locators) {
          if (await locator.isVisible().catch(() => false)) {
            return true;
          }
        }
        return false;
      },
      {
        message: "Expected one of the candidate locators to become visible.",
      },
    )
    .toBe(true);
}

export async function waitForNoVisibleText(page: Page, text: string | RegExp) {
  await expect(page.getByText(text)).toHaveCount(0);
}
