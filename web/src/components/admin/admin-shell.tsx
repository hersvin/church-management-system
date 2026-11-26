"use client";

import { LogOutIcon } from "@/components/icons";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type CSSProperties, type ReactNode } from "react";
import { EASE_OUT } from "@/components/motion";
import { StatusGlyph } from "@/components/status-glyph";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAttendanceStats } from "@/features/attendance/api";
import { useLogout, useSession } from "@/features/auth/api";
import { ApiError } from "@/lib/api-client";
import { breadcrumb, navGroups, visibleNavItems } from "./nav-items";
import { QuickSearch } from "./quick-search";

const initials = (first: string, last: string) =>
  `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
const roleLabel = (key: string) => key.toLowerCase().replaceAll("_", " ");

/** Attendance so far this week against the last full week, as a plain ink meter. */
function AttendanceMeter() {
  const stats = useAttendanceStats();
  const weeks = stats.data?.weeks ?? [];
  const now = weeks.at(-1)?.attendance ?? 0;
  const last = weeks.at(-2)?.attendance ?? 0;
  const pct = last > 0 ? Math.min(100, Math.round((now / last) * 100)) : 0;
  return (
    <Link
      href="/attendance"
      className="border-border bg-background hover:border-foreground/40 block rounded-md border p-3 transition-colors"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium">Attendance this week</span>
        <span className="font-data text-muted-foreground text-[11px]">
          {stats.data ? `${now}/${last}` : "--"}
        </span>
      </div>
      <div
        className="bg-border mt-2 h-1 overflow-hidden rounded-full"
        role="meter"
        aria-label="Attendance this week against last week"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <motion.div
          className="bg-foreground h-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: EASE_OUT }}
        />
      </div>
      {stats.data && stats.data.childrenInCare > 0 && (
        <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-[11px]">
          <StatusGlyph state="active" pulse />
          <span className="font-data">{stats.data.childrenInCare}</span> kids in
          care now
        </p>
      )}
    </Link>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();
  const logout = useLogout();

  useEffect(() => {
    if (session.error instanceof ApiError && session.error.status === 401) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [session.error, router, pathname]);

  if (!session.data) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  const user = session.data;
  const items = visibleNavItems(user.permissions);
  const crumb = breadcrumb(pathname);
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <SidebarProvider style={{ "--sidebar-width": "15rem" } as CSSProperties}>
      <Sidebar className="border-sidebar-border">
        <SidebarHeader className="gap-3 px-3 pt-4 pb-2">
          <Link href="/dashboard" className="flex items-center gap-2 px-1">
            <span
              className="border-foreground font-data grid size-6 place-items-center rounded-sm border text-[10px] font-semibold"
              aria-hidden
            >
              CA
            </span>
            <span className="text-sm font-semibold">Church Admin</span>
            <span className="font-data text-muted-foreground ml-auto text-[10px] uppercase">
              {user.branchId ? "branch" : "all"}
            </span>
          </Link>
          <QuickSearch items={items} onNavigate={(href) => router.push(href)} />
        </SidebarHeader>

        <SidebarContent className="gap-0">
          {navGroups(items).map((group) => (
            <SidebarGroup key={group.label} className="py-1.5">
              <SidebarGroupLabel className="micro-label h-6 px-2">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-px">
                  {group.items.map((item) => {
                    const active =
                      pathname === item.href ||
                      pathname.startsWith(`${item.href}/`);
                    return (
                      <SidebarMenuItem key={item.href}>
                        {item.comingSoon ? (
                          <SidebarMenuButton
                            disabled
                            aria-disabled
                            className="text-muted-foreground h-8"
                          >
                            <item.icon />
                            <span>{item.title}</span>
                            <span className="micro-label ml-auto text-[10px]">
                              Soon
                            </span>
                          </SidebarMenuButton>
                        ) : (
                          <SidebarMenuButton
                            isActive={active}
                            render={<Link href={item.href} />}
                            className="text-sidebar-foreground/80 hover:text-sidebar-foreground relative isolate h-8 rounded-md data-active:bg-sidebar-accent data-active:font-semibold data-active:text-sidebar-foreground"
                          >
                            {active && (
                              <motion.span
                                layoutId="sidebar-rule"
                                aria-hidden
                                className="bg-foreground absolute inset-y-1 left-0 w-0.75 rounded-r-sm"
                                transition={{
                                  type: "spring",
                                  stiffness: 520,
                                  damping: 42,
                                }}
                              />
                            )}
                            <item.icon className="transition-transform duration-150 group-hover/menu-button:translate-x-0.5" />
                            <span>{item.title}</span>
                          </SidebarMenuButton>
                        )}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter className="gap-3 p-3">
          {user.permissions.includes("attendance.read") && <AttendanceMeter />}
          <div className="flex items-center gap-2">
            <span
              className="border-border font-data grid size-7 shrink-0 place-items-center rounded-sm border text-[11px] font-semibold"
              aria-hidden
            >
              {initials(user.firstName, user.lastName)}
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-medium">
                {user.firstName} {user.lastName}
              </div>
              <div className="font-data text-muted-foreground truncate text-[11px]">
                {roleLabel(user.roleKey)}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Sign out"
              disabled={logout.isPending}
              onClick={() =>
                logout.mutate(undefined, {
                  onSettled: () => router.replace("/login"),
                })
              }
            >
              <LogOutIcon />
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-w-0 bg-background">
        <header data-print="hide" className="bg-background/95 border-border sticky top-0 z-20 flex h-13 items-center gap-3 border-b px-4 backdrop-blur-[2px] sm:px-6">
          <SidebarTrigger className="-ml-1" />
          <nav
            aria-label="Breadcrumb"
            className="flex min-w-0 items-center gap-2 text-sm"
          >
            <span className="font-data text-muted-foreground hidden sm:inline">
              cms
            </span>
            <span
              className="text-muted-foreground hidden sm:inline"
              aria-hidden
            >
              /
            </span>
            {crumb.detail ? (
              <>
                <Link
                  href={crumb.href}
                  className="text-muted-foreground hover:text-foreground truncate underline-offset-4 hover:underline"
                >
                  {crumb.module}
                </Link>
                <span className="text-muted-foreground" aria-hidden>
                  /
                </span>
                <span className="truncate font-semibold" aria-current="page">
                  {crumb.detail}
                </span>
              </>
            ) : (
              <span className="truncate font-semibold" aria-current="page">
                {crumb.module}
              </span>
            )}
          </nav>
          <span className="font-data text-muted-foreground ml-auto hidden text-xs md:inline">
            {today}
          </span>
        </header>
        <div className="mx-auto flex w-full max-w-350 flex-1 flex-col gap-4 p-4 sm:p-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
