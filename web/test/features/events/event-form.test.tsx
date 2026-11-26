import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventForm } from "@/features/events/event-form";

const BRANCH = "11111111-1111-4111-8111-111111111111";
const ROOM = "22222222-2222-4222-8222-222222222222";

function setup(response: () => Response, props: Partial<Parameters<typeof EventForm>[0]> = {}) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method) return response();
    if (url.startsWith("/api/rooms")) {
      return new Response(JSON.stringify({ items: [{ id: ROOM, name: "Sanctuary", isActive: true }], total: 1, page: 1, pageSize: 100 }));
    }
    return new Response(JSON.stringify({ items: [], total: 0, page: 1, pageSize: 100 }));
  });
  vi.stubGlobal("fetch", fetchMock);
  const onSaved = vi.fn();
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <EventForm
        branches={[{ id: BRANCH, name: "Main Campus", code: "MAIN" }]}
        canBookRooms
        onSaved={onSaved}
        onCancel={vi.fn()}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { fetchMock, onSaved };
}

async function fillBasics() {
  await userEvent.type(screen.getByLabelText(/^title/i), "Sunday Worship");
  await userEvent.type(screen.getByLabelText(/^starts/i), "2030-12-01T08:00");
  await userEvent.type(screen.getByLabelText(/^ends/i), "2030-12-01T09:30");
}

describe("EventForm", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("requires a title", async () => {
    const { fetchMock } = setup(() => new Response("{}"));
    await userEvent.click(screen.getByRole("button", { name: /save event/i }));
    // Title, start, and end are all required on an empty form.
    expect(await screen.findAllByText(/required/i)).toHaveLength(3);
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("previews how many dates a repeat creates", async () => {
    setup(() => new Response("{}"));
    await fillBasics();
    await userEvent.selectOptions(screen.getByLabelText(/repeats/i), "WEEKLY");
    await userEvent.type(screen.getByLabelText(/until/i), "2030-12-22");
    expect(await screen.findByText(/4 dates/i)).toBeInTheDocument();
  });

  it("creates a repeating event with a room", async () => {
    const { fetchMock, onSaved } = setup(
      () => new Response(JSON.stringify({ count: 4, seriesId: "s1", items: [{ id: "e1" }] }), { status: 201 }),
    );
    await fillBasics();
    await userEvent.selectOptions(screen.getByLabelText(/category/i), "SERVICE");
    await userEvent.selectOptions(await screen.findByLabelText(/^room/i), ROOM);
    await userEvent.selectOptions(screen.getByLabelText(/repeats/i), "WEEKLY");
    await userEvent.type(screen.getByLabelText(/until/i), "2030-12-22");
    await userEvent.click(screen.getByRole("button", { name: /save event/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(post[0]).toBe("/api/events");
    expect(JSON.parse(String(post[1]!.body))).toEqual({
      title: "Sunday Worship",
      category: "SERVICE",
      startsAt: "2030-12-01T00:00:00.000Z",
      endsAt: "2030-12-01T01:30:00.000Z",
      branchId: BRANCH,
      roomId: ROOM,
      registrationRequired: false,
      repeat: { frequency: "WEEKLY", until: "2030-12-22" },
    });
  });

  it("shows which dates clash when the room is taken", async () => {
    setup(
      () =>
        new Response(
          JSON.stringify({
            message: "The room is already booked at that time",
            conflicts: [
              {
                requestedStartsAt: "2030-12-15T00:00:00.000Z",
                requestedEndsAt: "2030-12-15T01:30:00.000Z",
                bookingId: "b1",
                startsAt: "2030-12-15T00:00:00.000Z",
                endsAt: "2030-12-15T02:00:00.000Z",
                purpose: "Wedding",
                eventTitle: "Cruz Wedding",
              },
            ],
          }),
          { status: 409 },
        ),
    );
    await fillBasics();
    await userEvent.selectOptions(await screen.findByLabelText(/^room/i), ROOM);
    await userEvent.click(screen.getByRole("button", { name: /save event/i }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/cruz wedding/i);
    expect(alert).toHaveTextContent(/dec 15/i);
  });

  it("hides the room picker without booking permission", () => {
    setup(() => new Response("{}"), { canBookRooms: false });
    expect(screen.queryByLabelText(/^room/i)).not.toBeInTheDocument();
  });
});
