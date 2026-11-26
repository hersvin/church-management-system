import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RoomForm } from "@/features/rooms/room-form";

const BRANCH = "11111111-1111-4111-8111-111111111111";

function setup(props: Partial<Parameters<typeof RoomForm>[0]> = {}) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "r1", name: "Hall" }), { status: 201 }));
  vi.stubGlobal("fetch", fetchMock);
  const onSaved = vi.fn();
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RoomForm branches={[{ id: BRANCH, name: "Main", code: "MAIN" }]} onSaved={onSaved} onCancel={vi.fn()} {...props} />
    </QueryClientProvider>,
  );
  return { fetchMock, onSaved };
}

describe("RoomForm", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("creates a room, splitting features on commas", async () => {
    const { fetchMock, onSaved } = setup();
    await userEvent.type(screen.getByLabelText(/^name/i), "Fellowship Hall");
    await userEvent.type(screen.getByLabelText(/capacity/i), "150");
    await userEvent.type(screen.getByLabelText(/features/i), "Kitchen, Projector , ,Tables");
    await userEvent.click(screen.getByRole("button", { name: /save room/i }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/rooms");
    expect(JSON.parse(String(init.body))).toEqual({
      name: "Fellowship Hall",
      branchId: BRANCH,
      capacity: 150,
      features: ["Kitchen", "Projector", "Tables"],
    });
  });

  it("sends only changed fields on edit", async () => {
    const { fetchMock, onSaved } = setup({
      room: {
        id: "r1",
        name: "Hall",
        capacity: 100,
        location: "Annex",
        description: null,
        features: ["Kitchen"],
        isActive: true,
        hourlyRate: 2500,
        branchId: BRANCH,
        branch: { id: BRANCH, name: "Main", code: "MAIN" },
      },
    });
    await userEvent.clear(screen.getByLabelText(/location/i));
    await userEvent.click(screen.getByRole("button", { name: /save room/i }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/rooms/r1");
    expect(JSON.parse(String(init.body))).toEqual({ location: null });
  });

  it("sends the hourly rate in pesos when creating a room", async () => {
    const { fetchMock, onSaved } = setup();
    await userEvent.type(screen.getByLabelText(/^name/i), "Prayer Room");
    await userEvent.type(screen.getByLabelText(/rate per hour/i), "350.50");
    await userEvent.click(screen.getByRole("button", { name: /save room/i }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({ name: "Prayer Room", hourlyRate: 350.5 });
  });

  it("rejects a rate with more than two decimals before sending", async () => {
    const { fetchMock } = setup();
    await userEvent.type(screen.getByLabelText(/^name/i), "Prayer Room");
    await userEvent.type(screen.getByLabelText(/rate per hour/i), "12.345");
    await userEvent.click(screen.getByRole("button", { name: /save room/i }));
    expect(await screen.findByText(/two decimals/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("clears the rate on edit when the field is emptied", async () => {
    const { fetchMock, onSaved } = setup({
      room: {
        id: "r1",
        name: "Hall",
        capacity: 100,
        location: null,
        description: null,
        features: [],
        isActive: true,
        hourlyRate: 2500,
        branchId: BRANCH,
        branch: { id: BRANCH, name: "Main", code: "MAIN" },
      },
    });
    expect(screen.getByLabelText(/rate per hour/i)).toHaveValue(2500);
    await userEvent.clear(screen.getByLabelText(/rate per hour/i));
    await userEvent.click(screen.getByRole("button", { name: /save room/i }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ hourlyRate: null });
  });
});
