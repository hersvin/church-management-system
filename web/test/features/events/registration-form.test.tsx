import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RegistrationForm } from "@/features/events/registration-form";

const EVENT = "99999999-9999-4999-8999-999999999999";
const BRANCH = "11111111-1111-4111-8111-111111111111";
const ANA = "55555555-5555-4555-8555-555555555555";

function setup() {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") return new Response(JSON.stringify({ id: "r1" }), { status: 201 });
    if (url.startsWith("/api/members")) {
      return new Response(
        JSON.stringify({ items: [{ id: ANA, firstName: "Ana", lastName: "Cruz", status: "MEMBER", email: null }], total: 1 }),
      );
    }
    return new Response("{}");
  });
  vi.stubGlobal("fetch", fetchMock);
  const onDone = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RegistrationForm eventId={EVENT} branchId={BRANCH} excludeMemberIds={[]} onDone={onDone} />
    </QueryClientProvider>,
  );
  const posted = () => {
    const call = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    return call ? { url: call[0], body: JSON.parse(String(call[1]!.body)) } : null;
  };
  return { onDone, posted };
}

describe("RegistrationForm", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("registers a member chosen from the search", async () => {
    const { onDone, posted } = setup();
    await userEvent.type(screen.getByLabelText(/find a person/i), "ana");
    await userEvent.click(await screen.findByRole("option", { name: /ana cruz/i }));
    await userEvent.click(screen.getByRole("button", { name: /^register$/i }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(true));
    expect(posted()).toEqual({ url: `/api/events/${EVENT}/registrations`, body: { memberId: ANA } });
  });

  it("registers a guest by name", async () => {
    const { onDone, posted } = setup();
    await userEvent.click(screen.getByRole("tab", { name: /guest/i }));
    await userEvent.type(screen.getByLabelText(/guest name/i), "Jo Smith");
    await userEvent.type(screen.getByLabelText(/email/i), "jo@example.org");
    await userEvent.click(screen.getByRole("button", { name: /^register$/i }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(true));
    expect(posted()!.body).toEqual({ guestName: "Jo Smith", guestEmail: "jo@example.org" });
  });

  it("asks for a person before submitting", async () => {
    const { posted } = setup();
    await userEvent.click(screen.getByRole("button", { name: /^register$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/choose a person/i);
    expect(posted()).toBeNull();
  });
});
