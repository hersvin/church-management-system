"use client";

import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { MotionRow, MotionTableBody } from "@/components/motion";
import { Table, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBranches } from "@/features/admin/queries";

export function BranchesView() {
  const branches = useBranches();
  return (
    <>
      <PageHeader title="Branches" description="Campuses that share this church's data." />
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <MotionTableBody>
            {branches.data?.map((b) => (
              <MotionRow key={b.id}>
                <TableCell className="font-mono">{b.code}</TableCell>
                <TableCell className="font-medium">{b.name}</TableCell>
                <TableCell>{b.address ?? "None"}</TableCell>
                <TableCell>{[b.phone, b.email].filter(Boolean).join(" / ") || "None"}</TableCell>
                <TableCell>
                  <Badge variant={b.isActive ? "secondary" : "outline"}>{b.isActive ? "Active" : "Inactive"}</Badge>
                </TableCell>
              </MotionRow>
            ))}
          </MotionTableBody>
        </Table>
      </div>
    </>
  );
}
