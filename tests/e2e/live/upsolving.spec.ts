import { expect, type Page, test } from "@playwright/test";

import { selectors } from "./helpers/selectors";
import { waitForAnyVisible } from "./helpers/wait";

async function expectTabToReachStableState(page: Page, tab: "gyms" | "contests") {
  const tabSelector =
    tab === "gyms" ? selectors.upsolvingTabGyms : selectors.upsolvingTabContests;
  await page.getByTestId(tabSelector).click();

  const loadingState = page.getByText(/loading upsolving/i);
  if (await loadingState.isVisible().catch(() => false)) {
    await expect(loadingState).toHaveCount(0);
  }

  await waitForAnyVisible([
    page.getByTestId(selectors.upsolvingProblemTable),
    page.getByText(new RegExp(`No ${tab} are ready for upsolving yet`, "i")),
    page.getByText(/No synced problems yet/i),
    page.locator(".form-message-error").filter({ hasText: /upsolving/i }).first(),
  ]);
}

test("loads both upsolving tabs and shows synced problems when data exists", async ({ page }) => {
  await page.goto("/upsolving");

  await expect(page.getByTestId(selectors.upsolvingPage)).toBeVisible();
  await expect(page.getByTestId(selectors.upsolvingTabGyms)).toBeVisible();
  await expect(page.getByTestId(selectors.upsolvingTabContests)).toBeVisible();

  await expectTabToReachStableState(page, "gyms");
  await expectTabToReachStableState(page, "contests");

  await page.getByTestId(selectors.upsolvingTabGyms).click();
  let problemTables = page.getByTestId(selectors.upsolvingProblemTable);
  if ((await problemTables.count()) === 0) {
    await page.getByTestId(selectors.upsolvingTabContests).click();
    problemTables = page.getByTestId(selectors.upsolvingProblemTable);
  }

  if ((await problemTables.count()) > 0) {
    await expect(problemTables.first()).toBeVisible();
  }
});
