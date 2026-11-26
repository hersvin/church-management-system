-- CreateEnum
CREATE TYPE "MinistryCategory" AS ENUM ('WORSHIP', 'CHILDREN', 'YOUTH', 'ADULTS', 'OUTREACH', 'PRAYER', 'HOSPITALITY', 'MEDIA', 'OTHER');

-- CreateEnum
CREATE TYPE "MinistryPosition" AS ENUM ('LEADER', 'COLEADER', 'MEMBER');

-- CreateTable
CREATE TABLE "Ministry" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "MinistryCategory" NOT NULL DEFAULT 'OTHER',
    "meetingSchedule" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "branchId" UUID NOT NULL,

    CONSTRAINT "Ministry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MinistryRole" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ministryId" UUID NOT NULL,

    CONSTRAINT "MinistryRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MinistryMember" (
    "id" UUID NOT NULL,
    "position" "MinistryPosition" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "ministryId" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "ministryRoleId" UUID,

    CONSTRAINT "MinistryMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ministry_branchId_category_idx" ON "Ministry"("branchId", "category");

-- CreateIndex
CREATE INDEX "Ministry_name_idx" ON "Ministry"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MinistryRole_ministryId_name_key" ON "MinistryRole"("ministryId", "name");

-- CreateIndex
CREATE INDEX "MinistryMember_ministryId_leftAt_idx" ON "MinistryMember"("ministryId", "leftAt");

-- CreateIndex
CREATE INDEX "MinistryMember_memberId_leftAt_idx" ON "MinistryMember"("memberId", "leftAt");

-- AddForeignKey
ALTER TABLE "Ministry" ADD CONSTRAINT "Ministry_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryRole" ADD CONSTRAINT "MinistryRole_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryMember" ADD CONSTRAINT "MinistryMember_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryMember" ADD CONSTRAINT "MinistryMember_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryMember" ADD CONSTRAINT "MinistryMember_ministryRoleId_fkey" FOREIGN KEY ("ministryRoleId") REFERENCES "MinistryRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;
