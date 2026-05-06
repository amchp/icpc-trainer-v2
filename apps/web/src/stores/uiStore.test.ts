import { describe, expect, it } from "vitest";
import { uiStore } from "./uiStore";

describe("uiStore", () => {
  it("tracks the active upsolving tab and selected contest", () => {
    uiStore.setActiveUpsolvingTab("contests");
    uiStore.setLastSelectedContestId(123);

    expect(uiStore.getState()).toMatchObject({
      activeUpsolvingTab: "contests",
      lastSelectedContestId: 123,
    });
  });
});
