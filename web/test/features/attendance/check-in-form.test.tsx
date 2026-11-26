import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CheckInForm } from "@/features/attendance/check-in-form";

const SERVICE = "99999999-9999-4999-8999-999999999999";
const BRANCH = "11111111-1111-4111-8111-111111111111";
const CHILD = "33333333-3333-4333-8333-333333333331";

function setup() {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.startsWith("/api/members")) {
      return new Response(
        JSON.stringify({ items: [{ id: CHILD, firstName: "Ada", lastName: "Okafor", status: "REGULAR", email: null }], total: 1, page: 1, pageSize: 8 }),
      );
    }
    const sent = JSON.parse(String(init?.body ?? "{}"));
    return new Response(JSON.stringify({ id: "new", ...sent, ...(sent.kind === "CHILD" ? { pickupCode: "K7RQX" } : {}) }));
  });
  vi.stubGlobal("fetch", fetchMock);
  const onCheckedIn = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CheckInForm target={{ type: "service", id: SERVICE }} branchId={BRANCH} excludeIds={[]} onCheckedIn={onCheckedIn} />
    </QueryClientProvider>,
  );
  const posts = () => fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === "POST");
  const body = () => JSON.parse(String((posts()[0] as [string, RequestInit])[1].body));
  return { onCheckedIn, posts, body };
}

describe("CheckInForm", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("clears the search after a member is checked in, ready for the next person", async () => {
    const { onCheckedIn } = setup();
    await userEvent.type(screen.getByLabelText(/find a person/i), "Ada");
    await userEvent.click(await screen.findByRole("option", { name: /ada okafor/i }));
    await userEvent.click(screen.getByRole("button", { name: /check in/i }));
    await waitFor(() => expect(onCheckedIn).toHaveBeenCalled());
    expect(screen.getByLabelText(/find a person/i)).toHaveValue("");
  });

  it("checks in a guest by name", async () => {
    const { body, onCheckedIn, posts } = setup();
    await userEvent.click(screen.getByRole("tab", { name: /guest/i }));
    await userEvent.type(screen.getByLabelText(/guest name/i), "Rosa Diaz");
    await userEvent.click(screen.getByRole("button", { name: /check in/i }));
    await waitFor(() => expect(onCheckedIn).toHaveBeenCalled());
    expect(posts()[0][0]).toBe(`/api/services/${SERVICE}/check-ins`);
    expect(body()).toEqual({ kind: "ATTENDEE", guestName: "Rosa Diaz" });
  });

  it("needs a guardian before a child is checked in", async () => {
    const { posts } = setup();
    await userEvent.click(screen.getByRole("tab", { name: /kid/i }));
    await userEvent.type(screen.getByLabelText(/find the child/i), "Ada");
    await userEvent.click(await screen.findByRole("option", { name: /ada okafor/i }));
    await userEvent.click(screen.getByRole("button", { name: /check in/i }));
    expect(await screen.findByText(/guardian/i, { selector: "p" })).toBeInTheDocument();
    expect(posts()).toHaveLength(0);
  });

  it("checks a child in with a guardian who is not a member and hands back the code", async () => {
    const { body, onCheckedIn } = setup();
    await userEvent.click(screen.getByRole("tab", { name: /kid/i }));
    await userEvent.type(screen.getByLabelText(/find the child/i), "Ada");
    await userEvent.click(await screen.findByRole("option", { name: /ada okafor/i }));
    await userEvent.click(screen.getByRole("radio", { name: /someone else/i }));
    await userEvent.type(screen.getByLabelText(/guardian name/i), "Lola Cruz");
    await userEvent.type(screen.getByLabelText(/guardian phone/i), "0917 000 0000");
    await userEvent.type(screen.getByLabelText(/care note/i), "Peanut allergy");
    await userEvent.click(screen.getByRole("button", { name: /check in/i }));
    await waitFor(() => expect(onCheckedIn).toHaveBeenCalledWith(expect.objectContaining({ pickupCode: "K7RQX" })));
    expect(body()).toEqual({
      kind: "CHILD",
      memberId: CHILD,
      guardianName: "Lola Cruz",
      guardianPhone: "0917 000 0000",
      careNote: "Peanut allergy",
    });
  });
});
