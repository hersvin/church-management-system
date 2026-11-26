"use client";

import { PageHeader } from "@/components/admin/page-header";
import { MotionRow, MotionTableBody } from "@/components/motion";
import { Table, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSettings } from "@/features/admin/queries";

function formatValue(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

export function SettingsView() {
  const settings = useSettings();
  const entries = Object.entries(settings.data ?? {}).sort(([a], [b]) => a.localeCompare(b));
  return (
    <>
      <PageHeader title="Settings" description="Church-wide configuration. Branch values override global ones." />
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-64">Key</TableHead>
              <TableHead>Value</TableHead>
            </TableRow>
          </TableHeader>
          <MotionTableBody>
            {entries.map(([key, value]) => (
              <MotionRow key={key}>
                <TableCell className="font-mono text-xs">{key}</TableCell>
                <TableCell>
                  <pre className="font-sans text-sm whitespace-pre-wrap">{formatValue(value)}</pre>
                </TableCell>
              </MotionRow>
            ))}
          </MotionTableBody>
        </Table>
      </div>
    </>
  );
}
