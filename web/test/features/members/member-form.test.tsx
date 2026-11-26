import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemberForm } from "@/features/members/member-form";

const BRANCH = "11111111-1111-4111-8111-111111111111";
const branches = [{ id: BRANCH, name: "Main Campus", code: "MAIN" }];

function renderForm(onSaved = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemberForm branches={branches} defaultBranchId={BRANCH} onSaved={onSaved} onCancel={vi.fn()} />
    </QueryClientProvider>,
  );
  return onSaved;
}

function stubFetch(handler: (url: string, init?: RequestInit) => Response) {
  const fn = vi.fn(async (url: string, init?: RequestInit) => handler(url, init));
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("MemberForm", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("requires first and last name before calling the API", async () => {
    const fetchMock = stubFetch(() => new Response(JSON.stringify({ items: [] })));
    renderForm();
    await userEvent.click(screen.getByRole("button", { name: /save member/i }));
    expect(await screen.findAllByText(/required/i)).not.toHaveLength(0);
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
  });

  it("creates a member and reports success", async () => {
    const fetchMock = stubFetch((url, init) =>
      init?.method === "POST"
        ? new Response(JSON.stringify({ id: "m1", firstName: "Ana", lastName: "Cruz" }), { status: 201 })
        : new Response(JSON.stringify({ items: [], total: 0, page: 1, pageSize: 100 })),
    );
    const onSaved = renderForm();
    await userEvent.type(screen.getByLabelText(/first name/i), "Ana");
    await userEvent.type(screen.getByLabelText(/last name/i), "Cruz");
    await userEvent.type(screen.getByLabelText(/^email/i), "ana@cms.local");
    await userEvent.click(screen.getByRole("button", { name: /save member/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(post[0]).toBe("/api/members");
    expect(JSON.parse(String(post[1]!.body))).toMatchObject({
      firstName: "Ana",
      lastName: "Cruz",
      email: "ana@cms.local",
      branchId: BRANCH,
      status: "VISITOR",
    });
  });
});
