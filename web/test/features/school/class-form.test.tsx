import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClassForm } from "@/features/school/class-form";
import { TermForm } from "@/features/school/term-form";

const BRANCH = "11111111-1111-4111-8111-111111111111";
const TERM = "22222222-2222-4222-8222-222222222222";

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function stubFetch() {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method) return new Response(JSON.stringify({ id: "x1", name: "Saved" }), { status: 201 });
    if (url.startsWith("/api/rooms")) return new Response(JSON.stringify({ items: [], total: 0, page: 1, pageSize: 100 }));
    return new Response("{}");
  });
  vi.stubGlobal("fetch", fetchMock);
  const sent = () => {
    const call = fetchMock.mock.calls.find(([, init]) => init?.method);
    return call ? { url: call[0], method: call[1]!.method, body: JSON.parse(String(call[1]!.body)) } : null;
  };
  return sent;
}

describe("ClassForm", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("creates a class with a weekly schedule", async () => {
    const sent = stubFetch();
    const onSaved = vi.fn();
    wrap(<ClassForm termId={TERM} branchId={BRANCH} onSaved={onSaved} onCancel={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/^name/i), "Grade 3 Bible");
    await userEvent.selectOptions(screen.getByLabelText(/audience/i), "CHILDREN");
    await userEvent.selectOptions(screen.getByLabelText(/meets on/i), "0");
    await userEvent.type(screen.getByLabelText(/^starts/i), "09:00");
    await userEvent.type(screen.getByLabelText(/^ends/i), "10:00");
    await userEvent.type(screen.getByLabelText(/capacity/i), "15");
    await userEvent.click(screen.getByRole("button", { name: /save class/i }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(sent()).toEqual({
      url: "/api/school/classes",
      method: "POST",
      body: { termId: TERM, name: "Grade 3 Bible", audience: "CHILDREN", meetingDay: 0, startTime: "09:00", endTime: "10:00", capacity: 15 },
    });
  });

  it("rejects an end time before the start time", async () => {
    const sent = stubFetch();
    wrap(<ClassForm termId={TERM} branchId={BRANCH} onSaved={vi.fn()} onCancel={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/^name/i), "Grade 3 Bible");
    await userEvent.type(screen.getByLabelText(/^starts/i), "10:00");
    await userEvent.type(screen.getByLabelText(/^ends/i), "09:00");
    await userEvent.click(screen.getByRole("button", { name: /save class/i }));
    expect(await screen.findByText(/end time must be after start time/i)).toBeInTheDocument();
    expect(sent()).toBeNull();
  });
});

describe("TermForm", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("creates a term with calendar dates", async () => {
    const sent = stubFetch();
    const onSaved = vi.fn();
    wrap(<TermForm branches={[{ id: BRANCH, name: "Main", code: "MAIN" }]} onSaved={onSaved} onCancel={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/^name/i), "Term 3");
    await userEvent.type(screen.getByLabelText(/^starts/i), "2027-03-01");
    await userEvent.type(screen.getByLabelText(/^ends/i), "2027-06-30");
    await userEvent.click(screen.getByRole("button", { name: /save term/i }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(sent()).toEqual({
      url: "/api/school/terms",
      method: "POST",
      body: { name: "Term 3", branchId: BRANCH, startsOn: "2027-03-01", endsOn: "2027-06-30" },
    });
  });
});
