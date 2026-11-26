"use client";

import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api-client";
import { formatDayLong, formatTime } from "@/lib/datetime";

interface ServiceQr {
  token: string;
  expiresAt: string;
  svg: string;
  service: { id: string; name: string; startsAt: string };
}

export const useServiceQr = (serviceId: string) =>
  useQuery({ queryKey: ["services", serviceId, "qr"], queryFn: () => apiFetch<ServiceQr>(`/services/${serviceId}/qr`), retry: false });

/**
 * The printable entrance poster: members scan it with the church app to check themselves in.
 * The code is valid until six hours after the service starts. The SVG from the API is used only
 * as an image source, never inserted as markup.
 */
export function ServiceQrPoster({ serviceId }: { serviceId: string }) {
  const qr = useServiceQr(serviceId);

  if (qr.isError) {
    return (
      <p role="alert" className="text-destructive text-sm">
        {qr.error.message}
      </p>
    );
  }
  if (!qr.data) return <Skeleton className="mx-auto aspect-square w-full max-w-sm" />;

  const { service, svg, expiresAt } = qr.data;
  return (
    <article className="bg-card border-border mx-auto flex w-full max-w-md flex-col items-center gap-4 rounded-lg border p-8 text-center print:max-w-none print:border-0">
      <p className="micro-label">Check-in</p>
      <h2 className="text-3xl font-semibold tracking-tight">Scan to check in</h2>
      <p className="text-muted-foreground text-sm">
        {service.name} · <span className="font-data">{formatDayLong(service.startsAt)}, {formatTime(service.startsAt)}</span>
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element -- inline SVG data, nothing to optimize */}
      <img
        src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
        alt={`Check-in code for ${service.name}`}
        className="border-border aspect-square w-full max-w-xs rounded-sm border"
      />
      <ol className="text-left text-sm">
        <li>1. Open the church app and tap Scan.</li>
        <li>2. Point your camera at this code.</li>
        <li>3. You are checked in. No forms, no line.</li>
      </ol>
      <p className="font-data text-muted-foreground text-xs">Valid until {formatTime(expiresAt)}</p>
    </article>
  );
}
