import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MinistryForm } from "@/features/ministries/ministry-form";

const BRANCH = "11111111-1111-4111-8111-111111111111";
const branches = [{ id: BRANCH, name: "Main Campus", code: "MAIN" }];

function setup(props: Partial<Parameters<typeof MinistryForm>[0]> = {}) {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
    new Response(JSON.stringify({ id: "m1", name: "Choir", ...JSON.parse(String(init?.body ?? "{}")) }), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const onSaved = vi.fn();
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MinistryForm branches={branches} onSaved={onSaved} onCancel={vi.fn()} {...props} />
    </QueryClientProvider>,
  );
  return { fetchMock, onSaved };
}

describe("MinistryForm", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("requires a name", async () => {
    const { fetchMock } = setup();
    await userEvent.click(screen.getByRole("button", { name: /save ministry/i }));
    expect(await screen.findByText(/required/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates a ministry", async () => {
    const { fetchMock, onSaved } = setup();
    await userEvent.type(screen.getByLabelText(/^name/i), "Choir");
    await userEvent.selectOptions(screen.getByLabelText(/category/i), "WORSHIP");
    await userEvent.type(screen.getByLabelText(/meeting schedule/i), "Thursdays 7 PM");
    await userEvent.click(screen.getByRole("button", { name: /save ministry/i }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/ministries");
    expect(JSON.parse(String(init!.body))).toEqual({
      name: "Choir",
      category: "WORSHIP",
      meetingSchedule: "Thursdays 7 PM",
      branchId: BRANCH,
    });
  });

  it("sends only changed fields when editing, and blank clears a field", async () => {
    const { fetchMock, onSaved } = setup({
      ministry: {
        id: "m1",
        name: "Choir",
        description: "Sings",
        category: "WORSHIP",
        meetingSchedule: null,
        isActive: true,
        branchId: BRANCH,
        branch: { id: BRANCH, name: "Main Campus", code: "MAIN" },
      },
    });
    await userEvent.clear(screen.getByLabelText(/description/i));
    await userEvent.click(screen.getByRole("button", { name: /save ministry/i }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/ministries/m1");
    expect(init!.method).toBe("PATCH");
    expect(JSON.parse(String(init!.body))).toEqual({ description: null });
  });
});
