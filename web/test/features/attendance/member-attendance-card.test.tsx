import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemberAttendanceCard } from "@/features/attendance/member-attendance-card";

const MEMBER = "33333333-3333-4333-8333-333333333333";

describe("MemberAttendanceCard", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("dates each entry by the service, not by when the person checked in", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            recentCount: 1,
            recentWeeks: 8,
            items: [
              {
                id: "c1",
                kind: "ATTENDEE",
                // Checked in early on Wednesday for the Sunday service.
                checkedInAt: "2026-11-25T01:00:00Z",
                service: { id: "s1", name: "Sunday Worship 9 AM", startsAt: "2026-11-29T01:00:00Z" },
                event: null,
              },
            ],
          }),
        ),
      ),
    );
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemberAttendanceCard memberId={MEMBER} />
      </QueryClientProvider>,
    );
    expect(await screen.findByText(/sunday, november 29, 2026/i)).toBeInTheDocument();
    expect(screen.queryByText(/november 25/i)).not.toBeInTheDocument();
    expect(screen.getByText(/1 check-in in the last 8 weeks/i)).toBeInTheDocument();
  });
});
