import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionStore } from "@/stores/session-store";
import { LoginForm } from "@/features/auth/login-form";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: push }) }));

function renderForm() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <LoginForm />
    </QueryClientProvider>,
  );
}

const sessionUser = {
  id: "u1",
  email: "admin@cms.local",
  firstName: "Ana",
  lastName: "Cruz",
  roleKey: "ADMIN",
  branchId: null,
  permissions: ["users.read"],
};

describe("LoginForm", () => {
  beforeEach(() => {
    push.mockReset();
    useSessionStore.getState().clear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("shows validation errors without calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderForm();
    await userEvent.type(screen.getByLabelText(/email/i), "not-an-email");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("signs in, stores the user, and goes to the dashboard", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(sessionUser), { status: 200 })),
    );
    renderForm();
    await userEvent.type(screen.getByLabelText(/email/i), "admin@cms.local");
    await userEvent.type(screen.getByLabelText(/password/i), "correct-password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    expect(useSessionStore.getState().user?.email).toBe("admin@cms.local");
  });

  it("shows the server error on failed sign in", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Invalid email or password" }), { status: 401 }),
      ),
    );
    renderForm();
    await userEvent.type(screen.getByLabelText(/email/i), "admin@cms.local");
    await userEvent.type(screen.getByLabelText(/password/i), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
    expect(push).not.toHaveBeenCalled();
  });
});
