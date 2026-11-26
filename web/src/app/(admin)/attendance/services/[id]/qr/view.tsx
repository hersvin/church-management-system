"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeftIcon, PrinterIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { ServiceQrPoster } from "@/features/attendance/service-qr-poster";

export function QrPosterView() {
  const { id } = useParams<{ id: string }>();
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/attendance/services/${id}`} className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1 text-sm">
          <ArrowLeftIcon className="size-4" />
          Back to the service
        </Link>
        <Button variant="outline" onClick={() => window.print()}>
          <PrinterIcon />
          Print poster
        </Button>
      </div>
      <ServiceQrPoster serviceId={id} />
    </>
  );
}
