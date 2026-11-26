import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LinkMemberForm } from "@/features/admin/link-member-form";

const BRANCH = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const MEMBER = "33333333-3333-4333-8333-333333333333";

const user = { id: USER, firstName: "Ngozi", lastName: "Okafor", email: "member.ngozi@cms.local", branchId: BRANCH, member: null };

function setup(overrides = {}) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.startsWith("/api/members?")) {
        return new Response(JSON.stringify({ items: [{ id: MEMBER, firstName: "Ngozi", lastName: "Okafor", status: "MEMBER", email: "ngozi.okafor@cms.local" }], total: 1, page: 1, pageSize: 8 }));
      }
      return new Response(JSON.stringify({ ...user, memberId: MEMBER }));
    }),
  );
  const onDone = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <LinkMemberForm user={{ ...user, ...overrides }} onDone={onDone} />
    </QueryClientProvider>,
  );
  return { calls, onDone };
}

describe("LinkMemberForm", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("links the account to the member chosen from a search", async () => {
    const { calls, onDone } = setup();
    await userEvent.type(screen.getByLabelText(/find the member/i), "Ngozi");
    await userEvent.click(await screen.findByRole("option", { name: /ngozi okafor/i }));
    await userEvent.click(screen.getByRole("button", { name: "Link member" }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    const patch = calls.find((c) => c.init?.method === "PATCH")!;
    expect(patch.url).toBe(`/api/users/${USER}`);
    expect(JSON.parse(String(patch.init?.body))).toEqual({ memberId: MEMBER });
  });

  it("removes an existing link", async () => {
    const { calls, onDone } = setup({ member: { id: MEMBER, firstName: "Ngozi", lastName: "Okafor" } });
    expect(screen.getByText(/linked to ngozi okafor/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remove link" }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(JSON.parse(String(calls.find((c) => c.init?.method === "PATCH")!.init?.body))).toEqual({ memberId: null });
  });

  it("asks for a branch first when the account covers all branches", () => {
    setup({ branchId: null });
    expect(screen.getByLabelText(/member's branch/i)).toBeInTheDocument();
  });
});
