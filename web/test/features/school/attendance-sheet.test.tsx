import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AttendanceSheet } from "@/features/school/attendance-sheet";

const SESSION = "99999999-9999-4999-8999-999999999999";
const E1 = "88888888-8888-4888-8888-888888888881";
const E2 = "88888888-8888-4888-8888-888888888882";

const register = [
  { enrollmentId: E1, member: { id: "m1", firstName: "Ana", lastName: "Cruz" }, status: "PRESENT" as const, note: null },
  { enrollmentId: E2, member: { id: "m2", firstName: "Ben", lastName: "Lim" }, status: null, note: null },
];

function setup(canEdit = true) {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
    new Response(JSON.stringify({ session: { id: SESSION }, register: JSON.parse(String(init?.body ?? "{}")).records ?? [] })),
  );
  vi.stubGlobal("fetch", fetchMock);
  const onSaved = vi.fn();
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AttendanceSheet sessionId={SESSION} register={register} canEdit={canEdit} onSaved={onSaved} />
    </QueryClientProvider>,
  );
  return { fetchMock, onSaved };
}

const body = (fetchMock: ReturnType<typeof vi.fn>) => JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body));

describe("AttendanceSheet", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows each student with their saved mark", () => {
    setup();
    const ana = screen.getByRole("radiogroup", { name: /ana cruz/i });
    expect(within(ana).getByRole("radio", { name: /present/i })).toBeChecked();
    const ben = screen.getByRole("radiogroup", { name: /ben lim/i });
    expect(within(ben).getByRole("radio", { name: /absent/i })).not.toBeChecked();
    expect(screen.getByText(/1 of 2 marked/i)).toBeInTheDocument();
  });

  it("saves the marks with PUT", async () => {
    const { fetchMock, onSaved } = setup();
    await userEvent.click(within(screen.getByRole("radiogroup", { name: /ben lim/i })).getByRole("radio", { name: /late/i }));
    await userEvent.click(screen.getByRole("button", { name: /save attendance/i }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/school/sessions/${SESSION}/attendance`);
    expect(init.method).toBe("PUT");
    expect(body(fetchMock)).toEqual({
      records: [
        { enrollmentId: E1, status: "PRESENT" },
        { enrollmentId: E2, status: "LATE" },
      ],
    });
  });

  it("marks everyone unmarked as present in one click", async () => {
    const { fetchMock } = setup();
    await userEvent.click(screen.getByRole("button", { name: /mark the rest present/i }));
    expect(screen.getByText(/2 of 2 marked/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /save attendance/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(body(fetchMock).records.map((r: { status: string }) => r.status)).toEqual(["PRESENT", "PRESENT"]);
  });

  it("is read-only without permission", () => {
    setup(false);
    expect(screen.queryByRole("button", { name: /save attendance/i })).not.toBeInTheDocument();
    for (const radio of screen.getAllByRole("radio")) expect(radio).toBeDisabled();
  });
});
