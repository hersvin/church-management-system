-- CreateEnum
CREATE TYPE "JoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "memberId" UUID;

-- CreateTable
CREATE TABLE "MinistryJoinRequest" (
    "id" UUID NOT NULL,
    "status" "JoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedById" UUID,
    "ministryId" UUID NOT NULL,
    "memberId" UUID NOT NULL,

    CONSTRAINT "MinistryJoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MinistryJoinRequest_ministryId_status_idx" ON "MinistryJoinRequest"("ministryId", "status");

-- CreateIndex
CREATE INDEX "MinistryJoinRequest_memberId_createdAt_idx" ON "MinistryJoinRequest"("memberId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_memberId_key" ON "User"("memberId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryJoinRequest" ADD CONSTRAINT "MinistryJoinRequest_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryJoinRequest" ADD CONSTRAINT "MinistryJoinRequest_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A member has at most one pending request per ministry.
CREATE UNIQUE INDEX "MinistryJoinRequest_one_pending" ON "MinistryJoinRequest" ("ministryId", "memberId")
  WHERE "status" = 'PENDING';
