import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { visibleNavItems } from "@/components/admin/nav-items";
import { QuickSearch } from "@/components/admin/quick-search";

const items = visibleNavItems(["members.read", "attendance.read", "rooms.read"]);

describe("QuickSearch", () => {
  it("opens from the keyboard shortcut and jumps to the first match on Enter", async () => {
    const onNavigate = vi.fn();
    render(<QuickSearch items={items} onNavigate={onNavigate} />);
    await userEvent.keyboard("{Control>}k{/Control}");
    const input = await screen.findByRole("combobox", { name: /search modules/i });
    await userEvent.type(input, "kids{Enter}");
    expect(onNavigate).toHaveBeenCalledWith("/attendance");
  });

  it("moves through results with the arrow keys", async () => {
    const onNavigate = vi.fn();
    render(<QuickSearch items={items} onNavigate={onNavigate} />);
    await userEvent.click(screen.getByRole("button", { name: /search/i }));
    const input = await screen.findByRole("combobox", { name: /search modules/i });
    await userEvent.type(input, "{ArrowDown}{Enter}");
    expect(onNavigate).toHaveBeenCalledWith(items.filter((i) => !i.comingSoon)[1].href);
  });

  it("says so when nothing matches", async () => {
    render(<QuickSearch items={items} onNavigate={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /search/i }));
    await userEvent.type(await screen.findByRole("combobox", { name: /search modules/i }), "zzz");
    await waitFor(() => expect(screen.getByText(/no module matches/i)).toBeInTheDocument());
  });
});
