-- CreateEnum
CREATE TYPE "CheckInKind" AS ENUM ('ATTENDEE', 'CHILD');

-- CreateTable
CREATE TABLE "Service" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "headcount" INTEGER,
    "notes" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "branchId" UUID NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckIn" (
    "id" UUID NOT NULL,
    "kind" "CheckInKind" NOT NULL DEFAULT 'ATTENDEE',
    "guestName" TEXT,
    "guestPhone" TEXT,
    "guardianName" TEXT,
    "guardianPhone" TEXT,
    "careNote" TEXT,
    "pickupCode" TEXT,
    "failedPickupAttempts" INTEGER NOT NULL DEFAULT 0,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedInById" UUID,
    "checkedOutAt" TIMESTAMP(3),
    "checkedOutById" UUID,
    "pickedUpByName" TEXT,
    "overrideReason" TEXT,
    "branchId" UUID NOT NULL,
    "serviceId" UUID,
    "eventId" UUID,
    "memberId" UUID,
    "guardianMemberId" UUID,
    "pickedUpByMemberId" UUID,

    CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Service_branchId_startsAt_idx" ON "Service"("branchId", "startsAt");

-- CreateIndex
CREATE INDEX "CheckIn_serviceId_checkedInAt_idx" ON "CheckIn"("serviceId", "checkedInAt");

-- CreateIndex
CREATE INDEX "CheckIn_eventId_checkedInAt_idx" ON "CheckIn"("eventId", "checkedInAt");

-- CreateIndex
CREATE INDEX "CheckIn_memberId_checkedInAt_idx" ON "CheckIn"("memberId", "checkedInAt");

-- CreateIndex
CREATE INDEX "CheckIn_branchId_checkedInAt_idx" ON "CheckIn"("branchId", "checkedInAt");

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_guardianMemberId_fkey" FOREIGN KEY ("guardianMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_pickedUpByMemberId_fkey" FOREIGN KEY ("pickedUpByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
