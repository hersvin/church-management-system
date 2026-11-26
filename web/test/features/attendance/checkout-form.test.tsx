import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CheckInRow } from "@/features/attendance/api";
import { CheckOutForm } from "@/features/attendance/checkout-form";

const CHECK_IN = "55555555-5555-4555-8555-555555555555";
const PARENT = "33333333-3333-4333-8333-333333333332";

const child: CheckInRow = {
  id: CHECK_IN,
  kind: "CHILD",
  memberId: "c",
  guestName: null,
  guestPhone: null,
  guardianName: null,
  guardianPhone: null,
  careNote: "Peanut allergy",
  checkedInAt: "2026-11-29T00:50:00Z",
  checkedOutAt: null,
  pickedUpByName: null,
  overrideReason: null,
  member: { id: "c", firstName: "Ada", lastName: "Okafor", birthDate: "2018-09-02" },
  guardianMember: { id: PARENT, firstName: "Emeka", lastName: "Okafor" },
  pickedUpByMember: null,
  locked: false,
  registered: null,
};

function setup({ row = child, canOverride = false } = {}) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/guardians")) {
      return new Response(
        JSON.stringify({
          guardianName: null,
          guardianPhone: null,
          members: [{ id: PARENT, firstName: "Emeka", lastName: "Okafor", householdRole: "HEAD", phone: null }],
        }),
      );
    }
    return new Response(JSON.stringify({ id: CHECK_IN, checkedOutAt: "2026-11-29T03:00:00Z", init: init?.method }));
  });
  vi.stubGlobal("fetch", fetchMock);
  const onDone = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CheckOutForm checkIn={row} canOverride={canOverride} onDone={onDone} />
    </QueryClientProvider>,
  );
  const posts = () => fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === "POST");
  const body = () => JSON.parse(String((posts()[0] as [string, RequestInit])[1].body));
  return { fetchMock, onDone, posts, body };
}

describe("CheckOutForm", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows the care note so staff see it before release", () => {
    setup();
    expect(screen.getByText(/peanut allergy/i)).toBeInTheDocument();
  });

  it("releases the child to a listed guardian with the pickup code", async () => {
    const { onDone, body } = setup();
    await userEvent.click(await screen.findByRole("radio", { name: /emeka okafor/i }));
    await userEvent.type(screen.getByLabelText(/pickup code/i), "k7r-qx");
    await userEvent.click(screen.getByRole("button", { name: /release child/i }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(body()).toEqual({ method: "CODE", code: "K7RQX", pickedUpByMemberId: PARENT });
  });

  it("asks for the code before sending anything", async () => {
    const { posts } = setup();
    await userEvent.click(await screen.findByRole("radio", { name: /emeka okafor/i }));
    await userEvent.click(screen.getByRole("button", { name: /release child/i }));
    expect(await screen.findByText(/5 characters/i)).toBeInTheDocument();
    expect(posts()).toHaveLength(0);
  });

  it("hides the override from staff without the permission", async () => {
    setup();
    await screen.findByRole("radio", { name: /emeka okafor/i });
    expect(screen.queryByRole("checkbox", { name: /release without code/i })).not.toBeInTheDocument();
  });

  it("lets a pastor release without the code when a reason is given", async () => {
    const { body, onDone } = setup({ canOverride: true });
    await userEvent.click(screen.getByRole("checkbox", { name: /release without code/i }));
    await userEvent.type(screen.getByLabelText(/collected by/i), "Ngozi Okafor");
    await userEvent.type(screen.getByLabelText(/reason/i), "Tag lost; ID checked");
    await userEvent.click(screen.getByRole("button", { name: /release child/i }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(body()).toEqual({ method: "OVERRIDE", reason: "Tag lost; ID checked", pickedUpByName: "Ngozi Okafor" });
  });

  it("explains a locked check-in and blocks the code", async () => {
    setup({ row: { ...child, locked: true } });
    expect(screen.getByText(/locked after too many wrong codes/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/pickup code/i)).toBeDisabled();
  });
});
