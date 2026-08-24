import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MandatoryPasskeyGate, ModuleSecurityGate, PasskeyGate } from "@/components/security/SecurityGate";
import { DEFAULT_SECURITY_SETTINGS } from "@/types/security";
import { markSecurityAuthentication } from "@/lib/securitySession";

let enrolled = false;
let tokenPasskeyVerifiedAt = 0;

vi.mock("@/auth/AuthContext", () => ({
  useAuth: () => ({
    user: {
      uid: "user-1",
      email: "person@example.com",
      getIdTokenResult: async () => ({ claims: { passkeyVerifiedAt: tokenPasskeyVerifiedAt } }),
    },
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
    tokenPasskeyVerifiedAt = 0;
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

  it("allows the app after an enrolled recent passkey verification", () => {
    enrolled = true;
    markSecurityAuthentication("user-1", "passkey");
    render(
      <MemoryRouter>
        <MandatoryPasskeyGate><p>Private app</p></MandatoryPasskeyGate>
      </MemoryRouter>,
    );
    expect(screen.getByText("Private app")).toBeInTheDocument();
  });

  it("offers password-confirmed recovery when this domain has no usable passkey", async () => {
    enrolled = true;
    render(
      <MemoryRouter>
        <MandatoryPasskeyGate><p>Private app</p></MandatoryPasskeyGate>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Can’t find your passkey? Set up this device" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Can’t find your passkey? Set up this device" }));
    expect(screen.getByText("Create a passkey for this device")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Account password")).toBeInTheDocument();
    expect(screen.queryByText("Private app")).not.toBeInTheDocument();
  });

  it("requires another passkey when opening Finance", async () => {
    enrolled = true;
    render(
      <MemoryRouter initialEntries={["/finance"]}>
        <ModuleSecurityGate><p>Finance content</p></ModuleSecurityGate>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByRole("heading", { name: "Protected page" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Continue with passkey" })).toBeInTheDocument();
    expect(screen.queryByText("Finance content")).not.toBeInTheDocument();
  });

  it("reuses a passkey login when opening Finance within seven days", async () => {
    enrolled = true;
    tokenPasskeyVerifiedAt = Math.floor(Date.now() / 1000) - 3 * 86_400;
    render(
      <MemoryRouter initialEntries={["/finance"]}>
        <ModuleSecurityGate><p>Finance content</p></ModuleSecurityGate>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText("Finance content")).toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: "Protected page" })).not.toBeInTheDocument();
  });

  it("asks again once the passkey period has run out", async () => {
    enrolled = true;
    tokenPasskeyVerifiedAt = Math.floor(Date.now() / 1000) - 8 * 86_400;
    markSecurityAuthentication("user-1", "passkey");
    render(
      <MemoryRouter initialEntries={["/finance"]}>
        <ModuleSecurityGate><p>Finance content</p></ModuleSecurityGate>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByRole("heading", { name: "Protected page" })).toBeInTheDocument());
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

  it("requires a recent passkey before display pairing", async () => {
    enrolled = true;
    render(
      <MemoryRouter>
        <PasskeyGate title="Approve a trusted display"><p>Pair screen</p></PasskeyGate>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByRole("heading", { name: "Approve a trusted display" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Continue with passkey" })).toBeInTheDocument();
    expect(screen.queryByText("Pair screen")).not.toBeInTheDocument();
  });

  it("reuses a passkey presented moments before display pairing", async () => {
    enrolled = true;
    tokenPasskeyVerifiedAt = Math.floor(Date.now() / 1000);
    render(
      <MemoryRouter>
        <PasskeyGate title="Approve a trusted display"><p>Pair screen</p></PasskeyGate>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText("Pair screen")).toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: "Approve a trusted display" })).not.toBeInTheDocument();
  });

  it("links a display without a new passkey when one was shown days ago", async () => {
    enrolled = true;
    tokenPasskeyVerifiedAt = Math.floor(Date.now() / 1000) - 4 * 86_400;
    render(
      <MemoryRouter>
        <PasskeyGate title="Approve a trusted display"><p>Pair screen</p></PasskeyGate>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText("Pair screen")).toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: "Approve a trusted display" })).not.toBeInTheDocument();
  });
});
