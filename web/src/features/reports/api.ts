"use client";

import type { Report, ReportKind, ReportQuery } from "@cms/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ApiError, apiFetch } from "@/lib/api-client";
import { reportSearch } from "./format";

export const useReport = (kind: ReportKind, query: ReportQuery) =>
  useQuery({
    queryKey: ["reports", kind, query],
    queryFn: () => apiFetch<Report>(`/reports/${kind}?${reportSearch(query)}`),
    placeholderData: keepPreviousData,
    retry: false,
  });

const FILENAME = /filename="([^"]+)"/;

/** Downloads the CSV through the same-origin proxy so the session cookie goes with it. */
export async function downloadReportCsv(kind: ReportKind, query: ReportQuery): Promise<void> {
  const response = await fetch(`/api/reports/${kind}/csv?${reportSearch(query)}`, { credentials: "include" });
  if (!response.ok) throw new ApiError(response.status, `Export failed with status ${response.status}`);
  const filename = FILENAME.exec(response.headers.get("content-disposition") ?? "")?.[1] ?? `${kind}.csv`;
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
