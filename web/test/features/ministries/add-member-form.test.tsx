import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AddMemberForm } from "@/features/ministries/add-member-form";

const MINISTRY = "44444444-4444-4444-8444-444444444444";
const BRANCH = "11111111-1111-4111-8111-111111111111";
const ANA = "55555555-5555-4555-8555-555555555555";
const BEN = "66666666-6666-4666-8666-666666666666";

const people = [
  { id: ANA, firstName: "Ana", lastName: "Cruz", status: "MEMBER", email: "ana@cms.local", branch: { name: "Main" } },
  { id: BEN, firstName: "Ben", lastName: "Cruz", status: "VISITOR", email: null, branch: { name: "Main" } },
];

function stubFetch() {
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") return new Response(JSON.stringify({ id: "mm1" }), { status: 201 });
    if (url.startsWith("/api/members")) {
      return new Response(JSON.stringify({ items: people, total: 2, page: 1, pageSize: 8 }));
    }
    return new Response("{}");
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

function renderForm(onDone = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AddMemberForm
        ministryId={MINISTRY}
        branchId={BRANCH}
        roles={[{ id: "77777777-7777-4777-8777-777777777777", name: "Vocalist" }]}
        excludeMemberIds={[BEN]}
        onDone={onDone}
      />
    </QueryClientProvider>,
  );
  return onDone;
}

describe("AddMemberForm", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("searches people in the ministry's branch and hides those already on the roster", async () => {
    const fetchMock = stubFetch();
    renderForm();
    await userEvent.type(screen.getByLabelText(/find a person/i), "cruz");
    expect(await screen.findByRole("option", { name: /ana cruz/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /ben cruz/i })).not.toBeInTheDocument();
    const searchUrl = fetchMock.mock.calls.map(([u]) => u).find((u) => u.startsWith("/api/members"))!;
    expect(searchUrl).toContain(`branchId=${BRANCH}`);
    expect(searchUrl).toContain("search=cruz");
  });

  it("requires choosing a person before saving", async () => {
    const fetchMock = stubFetch();
    renderForm();
    await userEvent.click(screen.getByRole("button", { name: /add to roster/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/choose a person/i);
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("adds the chosen person with position and role", async () => {
    const fetchMock = stubFetch();
    const onDone = renderForm();
    await userEvent.type(screen.getByLabelText(/find a person/i), "ana");
    await userEvent.click(await screen.findByRole("option", { name: /ana cruz/i }));
    await userEvent.selectOptions(screen.getByLabelText(/position/i), "LEADER");
    await userEvent.selectOptions(screen.getByLabelText(/volunteer role/i), "Vocalist");
    await userEvent.click(screen.getByRole("button", { name: /add to roster/i }));

    await waitFor(() => expect(onDone).toHaveBeenCalledWith(true));
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(post[0]).toBe(`/api/ministries/${MINISTRY}/members`);
    expect(JSON.parse(String(post[1]!.body))).toEqual({
      memberId: ANA,
      position: "LEADER",
      ministryRoleId: "77777777-7777-4777-8777-777777777777",
    });
  });
});
