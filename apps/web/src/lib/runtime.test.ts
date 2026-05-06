import { describe, expect, it } from "vitest";
import { resolveApiBaseUrl } from "./runtime";

describe("resolveApiBaseUrl", () => {
  it("prefers the desktop bridge value", () => {
    window.electronApp = {
      isDesktop: true,
      apiBaseUrl: "http://localhost:4010/",
    };

    expect(resolveApiBaseUrl()).toBe("http://localhost:4010");
  });

  it("falls back to the configured environment variable", () => {
    delete window.electronApp;
    import.meta.env.VITE_API_BASE_URL = "http://localhost:4020/";

    expect(resolveApiBaseUrl()).toBe("http://localhost:4020");
  });

  it("uses the default local server when nothing is configured", () => {
    delete window.electronApp;
    import.meta.env.VITE_API_BASE_URL = "";

    expect(resolveApiBaseUrl()).toBe("http://127.0.0.1:4000");
  });
});
