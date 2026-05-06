import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { sessionStore } from "../stores/sessionStore";
import { BlockingLoginScreen } from "./BlockingLoginScreen";

describe("BlockingLoginScreen", () => {
  it("renders the signed-login fields and submits them", async () => {
    const loginSpy = vi.spyOn(sessionStore, "login").mockResolvedValue({ ok: true });

    render(<BlockingLoginScreen />);

    fireEvent.change(screen.getByTestId("login-handle-input"), {
      target: { value: "tourist" },
    });
    fireEvent.change(screen.getByTestId("login-api-key-input"), {
      target: { value: "key" },
    });
    fireEvent.change(screen.getByTestId("login-api-secret-input"), {
      target: { value: "secret" },
    });
    fireEvent.click(screen.getByTestId("login-submit"));

    await waitFor(() =>
      expect(loginSpy).toHaveBeenCalledWith({
        handle: "tourist",
        apiKey: "key",
        apiSecret: "secret",
      }),
    );
  });
});
