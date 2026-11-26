import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BookingForm } from "@/features/rooms/booking-form";

const ROOM = "22222222-2222-4222-8222-222222222222";
const rooms = [{ id: ROOM, name: "Fellowship Hall" }];

function setup(response: Response) {
  const fetchMock = vi.fn(async () => response);
  vi.stubGlobal("fetch", fetchMock);
  const onDone = vi.fn();
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <BookingForm rooms={rooms} defaultRoomId={ROOM} onDone={onDone} />
    </QueryClientProvider>,
  );
  return { fetchMock, onDone };
}

async function fill(start: string, end: string) {
  await userEvent.type(screen.getByLabelText(/purpose/i), "Choir practice");
  await userEvent.type(screen.getByLabelText(/^starts/i), start);
  await userEvent.type(screen.getByLabelText(/^ends/i), end);
}

describe("BookingForm", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("requires the end after the start", async () => {
    const { fetchMock } = setup(new Response("{}"));
    await fill("2030-12-06T10:00", "2030-12-06T09:00");
    await userEvent.click(screen.getByRole("button", { name: /request booking/i }));
    expect(await screen.findByText(/end must be after start/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends UTC times for the chosen room", async () => {
    const { fetchMock, onDone } = setup(new Response(JSON.stringify({ id: "b1", status: "PENDING" }), { status: 201 }));
    await fill("2030-12-06T08:00", "2030-12-06T10:00");
    await userEvent.click(screen.getByRole("button", { name: /request booking/i }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ status: "PENDING" })));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/bookings");
    expect(JSON.parse(String(init.body))).toEqual({
      roomId: ROOM,
      purpose: "Choir practice",
      startsAt: "2030-12-06T00:00:00.000Z",
      endsAt: "2030-12-06T02:00:00.000Z",
    });
  });

  it("lists the clashing bookings when the room is taken", async () => {
    setup(
      new Response(
        JSON.stringify({
          message: "The room is already booked at that time",
          conflicts: [
            {
              requestedStartsAt: "2030-12-06T00:00:00.000Z",
              requestedEndsAt: "2030-12-06T02:00:00.000Z",
              bookingId: "b0",
              startsAt: "2030-12-06T01:00:00.000Z",
              endsAt: "2030-12-06T03:00:00.000Z",
              purpose: "Wedding rehearsal",
              eventTitle: null,
            },
          ],
        }),
        { status: 409 },
      ),
    );
    await fill("2030-12-06T08:00", "2030-12-06T10:00");
    await userEvent.click(screen.getByRole("button", { name: /request booking/i }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/already booked/i);
    expect(alert).toHaveTextContent(/wedding rehearsal/i);
  });
});
