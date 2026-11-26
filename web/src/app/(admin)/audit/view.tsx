"use client";

import { useState } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { MotionRow, MotionTableBody } from "@/components/motion";
import { Table, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAudit } from "@/features/admin/queries";

export function AuditView() {
  const [page, setPage] = useState(1);
  const audit = useAudit(page);
  const totalPages = audit.data ? Math.max(1, Math.ceil(audit.data.total / audit.data.pageSize)) : 1;
  return (
    <>
      <PageHeader title="Audit log" description="Every sign-in and change, newest first." />
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>IP address</TableHead>
            </TableRow>
          </TableHeader>
          <MotionTableBody>
            {audit.data?.items.map((row) => (
              <MotionRow key={row.id}>
                <TableCell className="whitespace-nowrap">{new Date(row.createdAt).toLocaleString()}</TableCell>
                <TableCell className="font-mono text-xs">{row.action}</TableCell>
                <TableCell>{row.entity}</TableCell>
                <TableCell>{row.ipAddress ?? "None"}</TableCell>
              </MotionRow>
            ))}
          </MotionTableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end gap-2 text-sm">
        <span className="text-muted-foreground">
          Page {page} of {totalPages}
        </span>
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Previous
        </Button>
        <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
          Next
        </Button>
      </div>
    </>
  );
}
