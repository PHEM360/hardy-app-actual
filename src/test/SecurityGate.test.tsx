import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MandatoryPasskeyGate, ModuleSecurityGate } from "@/components/security/SecurityGate";
import { DEFAULT_SECURITY_SETTINGS } from "@/types/security";
import { markSecurityAuthentication } from "@/lib/securitySession";

let enrolled = false;

vi.mock("@/auth/AuthContext", () => ({
  useAuth: () => ({
    user: { uid: "user-1", email: "person@example.com" },
  }),
}));

vi.mock("@/hooks/useSecuritySettings", () => ({
  useSecuritySettings: () => ({
    settings: DEFAULT_SECURITY_SETTINGS,
    passkeyEnrolled: enrolled,
    loading: false,
  }),
}));

vi.mock("@/lib/passkeys", () => ({
  authenticateWithPasskey: vi.fn(),
  passkeyErrorMessage: () => "Passkey failed",
  passkeysSupported: () => true,
  registerPasskey: vi.fn(),
}));

describe("security gates", () => {
  beforeEach(() => {
    enrolled = false;
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("blocks an existing account until a passkey is enrolled", () => {
    render(
      <MemoryRouter>
        <MandatoryPasskeyGate><p>Private app</p></MandatoryPasskeyGate>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Create your passkey" })).toBeInTheDocument();
    expect(screen.queryByText("Private app")).not.toBeInTheDocument();
  });

  it("allows the app after enrolled monthly passkey verification", () => {
    enrolled = true;
    markSecurityAuthentication("user-1", "passkey");
    render(
      <MemoryRouter>
        <MandatoryPasskeyGate><p>Private app</p></MandatoryPasskeyGate>
      </MemoryRouter>,
    );
    expect(screen.getByText("Private app")).toBeInTheDocument();
  });

  it("requires another passkey when opening Finance", () => {
    enrolled = true;
    render(
      <MemoryRouter initialEntries={["/finance"]}>
        <ModuleSecurityGate><p>Finance content</p></ModuleSecurityGate>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Protected page" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with passkey" })).toBeInTheDocument();
    expect(screen.queryByText("Finance content")).not.toBeInTheDocument();
  });

  it("opens modules with no additional security requirement", () => {
    enrolled = true;
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <ModuleSecurityGate><p>Dashboard content</p></ModuleSecurityGate>
      </MemoryRouter>,
    );
    expect(screen.getByText("Dashboard content")).toBeInTheDocument();
  });
});
