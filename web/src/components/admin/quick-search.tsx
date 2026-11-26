"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useEffect, useId, useState } from "react";
import { SearchIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { searchNav, type NavItem } from "./nav-items";

export interface QuickSearchProps {
  items: NavItem[];
  onNavigate: (href: string) => void;
}

/** "Search..." field in the sidebar that opens a module jumper; Ctrl+K or Cmd+K opens it from anywhere. */
export function QuickSearch({ items, onNavigate }: QuickSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const results = searchNav(items, query);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function change(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
      setActive(0);
    }
  }

  function go(href: string) {
    change(false);
    onNavigate(href);
  }

  return (
    <Dialog.Root open={open} onOpenChange={change}>
      <Dialog.Trigger
        className="border-border bg-background text-muted-foreground hover:text-foreground flex h-8 w-full items-center gap-2 rounded-md border px-2 text-sm transition-colors"
        aria-label="Search modules"
      >
        <SearchIcon className="size-3.5" />
        <span className="flex-1 text-left">Search...</span>
        <kbd className="font-data border-border rounded-sm border px-1 text-[10px] leading-4">Ctrl K</kbd>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-[rgb(20_19_16/0.18)] transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="bg-popover border-border fixed top-[18vh] left-1/2 z-50 w-[min(92vw,28rem)] -translate-x-1/2 rounded-lg border transition-all duration-200 data-[ending-style]:-translate-y-1 data-[ending-style]:opacity-0 data-[starting-style]:-translate-y-1 data-[starting-style]:opacity-0">
          <Dialog.Title className="sr-only">Search modules</Dialog.Title>
          <div className="border-border flex items-center gap-2 border-b px-3">
            <SearchIcon className="text-muted-foreground size-4" />
            <input
              autoFocus
              role="combobox"
              aria-label="Search modules"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
              className="h-11 flex-1 bg-transparent text-sm outline-none"
              placeholder="Jump to a module"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(a + 1, results.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                } else if (e.key === "Enter" && results[active]) {
                  e.preventDefault();
                  go(results[active].href);
                }
              }}
            />
          </div>
          <ul id={listId} role="listbox" aria-label="Modules" className="max-h-72 overflow-y-auto p-1">
            {results.map((item, i) => (
              <li
                key={item.href}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(item.href)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                  i === active ? "bg-muted font-medium" : "text-foreground",
                )}
              >
                <item.icon className="size-4" />
                <span className="flex-1">{item.title}</span>
                <span className="micro-label">{item.group}</span>
              </li>
            ))}
            {results.length === 0 && <li className="text-muted-foreground px-2 py-3 text-sm">No module matches.</li>}
          </ul>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
