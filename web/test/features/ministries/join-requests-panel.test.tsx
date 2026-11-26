import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JoinRequestsPanel } from "@/features/ministries/join-requests-panel";

const MINISTRY = "44444444-4444-4444-8444-444444444444";
const REQUEST = "66666666-6666-4666-8666-666666666666";

function setup(pending: unknown[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (init?.method === "POST") return new Response(JSON.stringify({ id: REQUEST, status: "APPROVED" }));
      return new Response(JSON.stringify(pending));
    }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <JoinRequestsPanel ministryId={MINISTRY} />
    </QueryClientProvider>,
  );
  return calls;
}

describe("JoinRequestsPanel", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lists pending requests from the app and approves one", async () => {
    const calls = setup([
      { id: REQUEST, note: "I play guitar", createdAt: "2026-11-25T02:00:00Z", member: { id: "m1", firstName: "Ngozi", lastName: "Okafor" } },
    ]);
    expect(await screen.findByText("Ngozi Okafor")).toBeInTheDocument();
    expect(screen.getByText("I play guitar")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Approve Ngozi Okafor" }));
    await waitFor(() => expect(calls.some((c) => c.init?.method === "POST")).toBe(true));
    const post = calls.find((c) => c.init?.method === "POST")!;
    expect(post.url).toBe(`/api/ministry-requests/${REQUEST}/decision`);
    expect(JSON.parse(String(post.init?.body))).toEqual({ decision: "APPROVED" });
  });

  it("says when nobody is waiting", async () => {
    setup([]);
    expect(await screen.findByText(/no requests waiting/i)).toBeInTheDocument();
  });
});
