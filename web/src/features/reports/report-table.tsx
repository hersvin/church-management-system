"use client";

import type { Report } from "@cms/shared";
import { MotionRow, MotionTableBody, Stagger, StaggerItem } from "@/components/motion";
import { Table, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatReportValue } from "./format";

const isNumeric = (kind: string) => kind === "number" || kind === "percent" || kind === "money";

/** Summary stat line plus the report rows. Columns come from the report, so one table serves every kind. */
export function ReportTable({ report }: { report: Report }) {
  return (
    <div className="flex flex-col gap-4">
      <Stagger className="border-border bg-card grid grid-cols-2 gap-px overflow-hidden rounded-lg border sm:grid-cols-4 print:grid-cols-4">
        {report.summary.map((s) => (
          <StaggerItem key={s.label} className="bg-card px-4 py-3">
            <div className="micro-label">{s.label}</div>
            <div className="font-data mt-1 text-xl font-semibold">{formatReportValue(s.value, s.kind)}</div>
          </StaggerItem>
        ))}
      </Stagger>

      {report.rows.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-lg border border-dashed p-6 text-center text-sm">
          Nothing in this range.
        </p>
      ) : (
        <div className="border-border overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                {report.columns.map((c) => (
                  <TableHead key={c.key} className={cn(isNumeric(c.kind) && "text-right")}>
                    {c.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <MotionTableBody>
              {report.rows.map((row, i) => (
                <MotionRow key={i} className="break-inside-avoid">
                  {report.columns.map((c) => (
                    <TableCell
                      key={c.key}
                      className={cn((isNumeric(c.kind) || c.kind === "date") && "font-data", isNumeric(c.kind) && "text-right")}
                    >
                      {formatReportValue(row[c.key] ?? null, c.kind)}
                    </TableCell>
                  ))}
                </MotionRow>
              ))}
            </MotionTableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
