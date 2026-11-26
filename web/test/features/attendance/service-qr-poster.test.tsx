import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ServiceQrPoster } from "@/features/attendance/service-qr-poster";

const SERVICE = "99999999-9999-4999-8999-999999999999";

function renderPoster() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ServiceQrPoster serviceId={SERVICE} />
    </QueryClientProvider>,
  );
}

describe("ServiceQrPoster", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows the service's check-in code as an image with plain instructions", async () => {
    const fetchMock = vi.fn<(url: string) => Promise<Response>>(async () =>
      new Response(
        JSON.stringify({
          token: "cmsqr1.abc.def",
          expiresAt: "2026-11-29T07:00:00.000Z",
          svg: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
          service: { id: SERVICE, name: "Sunday Worship 9 AM", startsAt: "2026-11-29T01:00:00.000Z" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { container } = renderPoster();

    const image = await screen.findByRole("img", { name: /check-in code for sunday worship 9 am/i });
    expect(image.getAttribute("src")).toMatch(/^data:image\/svg\+xml;/);
    // The SVG is only ever an image source, never markup in the page.
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByRole("heading", { name: /scan to check in/i })).toBeInTheDocument();
    expect(screen.getByText(/open the church app/i)).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/services/${SERVICE}/qr`);
  });

  it("explains when the service has finished", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: "This service has finished" }), { status: 400 })));
    renderPoster();
    expect(await screen.findByRole("alert")).toHaveTextContent("This service has finished");
  });
});
