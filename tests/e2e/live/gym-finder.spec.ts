import { expect, test } from "@playwright/test";

import { selectors } from "./helpers/selectors";
import { waitForAnyVisible } from "./helpers/wait";

test("loads gym finder after login and reaches a stable page state", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId(selectors.navGymFinder).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId(selectors.gymFinderPage)).toBeVisible();
  await expect(page.getByTestId(selectors.loginForm)).toHaveCount(0);

  const loadingState = page.getByText(/loading gym recommendations/i);
  if (await loadingState.isVisible().catch(() => false)) {
    await expect(loadingState).toHaveCount(0);
  }

  await waitForAnyVisible([
    page.getByTestId(selectors.gymFinderResults),
    page.getByText(/add at least one friend/i),
    page.getByText(/no gyms qualified/i),
  ]);

  const resultCards = page.getByTestId(selectors.gymFinderResultCard);
  if ((await resultCards.count()) > 0) {
    const firstCard = resultCards.first();
    await expect(firstCard.getByTestId(selectors.gymFinderContestLink)).toBeVisible();
    await expect(firstCard).toContainText(/coverage|Open gym/i);
  }
});
