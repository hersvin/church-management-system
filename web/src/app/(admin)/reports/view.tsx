"use client";

import { REPORT_KINDS, type ReportKind } from "@cms/shared";
import { motion } from "motion/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/page-header";
import { DownloadIcon, PrinterIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { useBranches } from "@/features/admin/queries";
import { downloadReportCsv, useReport } from "@/features/reports/api";
import { REPORT_META, readReportParams, reportHref } from "@/features/reports/format";
import { ReportTable } from "@/features/reports/report-table";
import { useSessionStore } from "@/stores/session-store";

/**
 * Updates the URL in place. Next keeps useSearchParams in sync with history.replaceState,
 * and skipping a router navigation keeps the admin template from replaying its entrance.
 */
const showReport = (href: string) => window.history.replaceState(null, "", href);

export function ReportsView() {
  const params = useSearchParams();
  const { kind, query } = readReportParams(new URLSearchParams(params.toString()));
  const me = useSessionStore((s) => s.user);
  const can = useSessionStore((s) => s.can);
  const churchWide = !me?.branchId;
  const branches = useBranches(churchWide && can("branches.read"));
  const report = useReport(kind, query);
  const [exporting, setExporting] = useState(false);

  const branchName = report.data?.branchId
    ? (branches.data?.find((b) => b.id === report.data?.branchId)?.name ?? "One branch")
    : "All branches";

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (key: string) => (form.get(key) as string | null) || undefined;
    showReport(reportHref(kind, { from: value("from"), to: value("to"), branchId: value("branchId") }));
  }

  async function exportCsv() {
    setExporting(true);
    try {
      await downloadReportCsv(kind, query);
    } catch {
      toast.error("The CSV could not be downloaded. Check the dates and try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Reports"
          description="Attendance, growth, participation, turnout, and room use for any date range."
          actions={
            <div className="flex gap-2">
              <Button variant="outline" onClick={exportCsv} disabled={exporting || !report.data}>
                <DownloadIcon />
                CSV
              </Button>
              <Button variant="outline" onClick={() => window.print()} disabled={!report.data}>
                <PrinterIcon />
                PDF
              </Button>
            </div>
          }
        />
      </div>

      <nav aria-label="Report" className="border-border -mx-1 flex gap-1 overflow-x-auto overflow-y-hidden border-b px-1 print:hidden">
        {REPORT_KINDS.map((k: ReportKind) => {
          const active = k === kind;
          return (
            <Link
              key={k}
              href={reportHref(k, query)}
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
                event.preventDefault();
                showReport(reportHref(k, query));
              }}
              aria-current={active ? "page" : undefined}
              className="text-muted-foreground hover:text-foreground aria-[current=page]:text-foreground relative shrink-0 px-3 py-2 text-sm whitespace-nowrap transition-colors aria-[current=page]:font-semibold"
            >
              {REPORT_META[k].label}
              {active && (
                <motion.span
                  layoutId="report-tab-rule"
                  aria-hidden
                  className="bg-foreground absolute inset-x-2 -bottom-px h-0.5"
                  transition={{ type: "spring", stiffness: 520, damping: 42 }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      <form
        // Remount (to refresh the default values) only when the filters change or the first data arrives, not on a tab switch.
        key={`${query.from}|${query.to}|${query.branchId}|${report.data ? "ready" : "loading"}`}
        onSubmit={apply}
        className="flex flex-wrap items-end gap-3 print:hidden"
        aria-label="Report filters"
      >
        <div className="grid gap-1">
          <Label htmlFor="report-from">From</Label>
          <Input id="report-from" name="from" type="date" defaultValue={report.data?.from ?? query.from} className="w-40" />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="report-to">To</Label>
          <Input id="report-to" name="to" type="date" defaultValue={report.data?.to ?? query.to} className="w-40" />
        </div>
        {churchWide && branches.data && (
          <div className="grid gap-1">
            <Label htmlFor="report-branch">Branch</Label>
            <NativeSelect id="report-branch" name="branchId" defaultValue={query.branchId ?? ""} className="w-44">
              <option value="">All branches</option>
              {branches.data.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}
        <Button type="submit">Show report</Button>
      </form>

      <section aria-labelledby="report-title" className="flex flex-col gap-3">
        <div>
          <h2 id="report-title" className="text-lg font-semibold">
            {REPORT_META[kind].label}
          </h2>
          <p className="text-muted-foreground text-sm">
            {report.data ? (
              <>
                <span className="font-data">
                  {report.data.from} to {report.data.to}
                </span>
                {" · "}
                {branchName}
              </>
            ) : (
              REPORT_META[kind].description
            )}
          </p>
          <p className="text-muted-foreground text-xs print:hidden">{REPORT_META[kind].description}</p>
        </div>
        {report.isError ? (
          <p role="alert" className="text-destructive text-sm">
            {report.error.message}
          </p>
        ) : report.data ? (
          <div className={report.isFetching ? "opacity-60 transition-opacity" : "transition-opacity"}>
            <ReportTable report={report.data} />
          </div>
        ) : (
          <Skeleton className="h-64 w-full" />
        )}
      </section>
    </>
  );
}
