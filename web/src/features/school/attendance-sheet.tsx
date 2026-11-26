"use client";

import { ATTENDANCE_STATUSES, type AttendanceStatus } from "@cms/shared";
import { motion } from "motion/react";
import { useState } from "react";
import { ErrorAlert } from "@/components/conflict-alert";
import { CheckIcon } from "@/components/icons";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { fullName, initials } from "@/features/members/format";
import { cn } from "@/lib/utils";
import { useSaveAttendance, type RegisterRow, type SessionDetail } from "./api";
import { ATTENDANCE_META } from "./format";

export interface AttendanceSheetProps {
  sessionId: string;
  register: RegisterRow[];
  canEdit: boolean;
  onSaved: (result: SessionDetail) => void;
}

/** One row per student with Present / Late / Absent / Excused toggles. */
export function AttendanceSheet({ sessionId, register, canEdit, onSaved }: AttendanceSheetProps) {
  const [marks, setMarks] = useState<Record<string, AttendanceStatus | null>>(() =>
    Object.fromEntries(register.map((r) => [r.enrollmentId, r.status])),
  );
  const save = useSaveAttendance(sessionId);
  const marked = register.filter((r) => marks[r.enrollmentId]).length;

  const markRestPresent = () =>
    setMarks((m) => Object.fromEntries(register.map((r) => [r.enrollmentId, m[r.enrollmentId] ?? "PRESENT"])));

  const submit = () => {
    const records = register.flatMap((r) =>
      marks[r.enrollmentId] ? [{ enrollmentId: r.enrollmentId, status: marks[r.enrollmentId]! }] : [],
    );
    save.mutate(records, { onSuccess: onSaved });
  };

  if (register.length === 0) {
    return <p className="text-muted-foreground text-sm">No students are enrolled for this date.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground font-data">
          {marked} of {register.length} marked
        </span>
        {canEdit && marked < register.length && (
          <Button size="sm" variant="outline" onClick={markRestPresent}>
            <CheckIcon />
            Mark the rest present
          </Button>
        )}
      </div>

      <ul className="flex flex-col divide-y rounded-lg border">
        {register.map((row, i) => (
          <motion.li
            key={row.enrollmentId}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0, transition: { delay: i * 0.03 } }}
            className="flex flex-wrap items-center gap-3 px-3 py-2"
          >
            <Avatar className="size-8">
              <AvatarFallback className="text-xs">{initials(row.member)}</AvatarFallback>
            </Avatar>
            <span className="min-w-32 flex-1 text-sm font-medium">{fullName(row.member)}</span>
            <div role="radiogroup" aria-label={`Attendance for ${fullName(row.member)}`} className="bg-muted flex gap-0.5 rounded-lg p-0.5">
              {ATTENDANCE_STATUSES.map((status) => {
                const active = marks[row.enrollmentId] === status;
                return (
                  <button
                    key={status}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={ATTENDANCE_META[status].label}
                    disabled={!canEdit}
                    onClick={() => setMarks((m) => ({ ...m, [row.enrollmentId]: status }))}
                    className={cn(
                      "relative rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-default",
                      active ? "text-white" : "text-muted-foreground enabled:hover:text-foreground",
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId={`mark-${row.enrollmentId}`}
                        className={cn("absolute inset-0 rounded-md", ATTENDANCE_META[status].active)}
                        transition={{ type: "spring", stiffness: 500, damping: 35 }}
                      />
                    )}
                    <span className="relative">
                      <span className="sm:hidden">{ATTENDANCE_META[status].short}</span>
                      <span className="hidden sm:inline">{ATTENDANCE_META[status].label}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.li>
        ))}
      </ul>

      <ErrorAlert error={save.error} />
      {canEdit && (
        <Button onClick={submit} disabled={marked === 0 || save.isPending} className="self-start">
          {save.isPending ? "Saving..." : "Save attendance"}
        </Button>
      )}
    </div>
  );
}
