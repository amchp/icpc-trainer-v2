import { expect, test } from "@playwright/test";

import { selectors, teamHandleChipTestId } from "./helpers/selectors";

const TEAMMATE_HANDLE = "Benq";

test("adds and removes a teammate from the live roster", async ({ page }) => {
  await page.goto("/team");

  await expect(page.getByTestId(selectors.teamPage)).toBeVisible();

  const existingChip = page.getByTestId(teamHandleChipTestId(TEAMMATE_HANDLE));
  if (await existingChip.isVisible().catch(() => false)) {
    await existingChip.click();
    await expect(existingChip).toHaveCount(0);
  }

  await page.getByTestId(selectors.teamAddInput).fill(TEAMMATE_HANDLE);
  await page.getByTestId(selectors.teamAddSubmit).click();

  await expect(page.getByTestId(teamHandleChipTestId(TEAMMATE_HANDLE))).toBeVisible();
  await expect(page.getByTestId(selectors.teamAddInput)).toHaveValue("");

  await page.getByTestId(teamHandleChipTestId(TEAMMATE_HANDLE)).click();
  await expect(page.getByTestId(teamHandleChipTestId(TEAMMATE_HANDLE))).toHaveCount(0);
});
