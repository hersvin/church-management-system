-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('VISITOR', 'REGULAR', 'MEMBER', 'INACTIVE');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'UNSPECIFIED');

-- CreateEnum
CREATE TYPE "CivilStatus" AS ENUM ('SINGLE', 'MARRIED', 'WIDOWED', 'SEPARATED');

-- CreateEnum
CREATE TYPE "HouseholdRole" AS ENUM ('HEAD', 'SPOUSE', 'CHILD', 'OTHER');

-- CreateTable
CREATE TABLE "Household" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "branchId" UUID NOT NULL,

    CONSTRAINT "Household_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "suffix" TEXT,
    "gender" "Gender" NOT NULL DEFAULT 'UNSPECIFIED',
    "civilStatus" "CivilStatus",
    "birthDate" DATE,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "occupation" TEXT,
    "status" "MemberStatus" NOT NULL DEFAULT 'VISITOR',
    "membershipDate" DATE,
    "baptismDate" DATE,
    "notes" TEXT,
    "householdRole" "HouseholdRole",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "branchId" UUID NOT NULL,
    "householdId" UUID,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberStatusHistory" (
    "id" UUID NOT NULL,
    "fromStatus" "MemberStatus",
    "toStatus" "MemberStatus" NOT NULL,
    "note" TEXT,
    "changedById" UUID,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "memberId" UUID NOT NULL,

    CONSTRAINT "MemberStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Household_branchId_idx" ON "Household"("branchId");

-- CreateIndex
CREATE INDEX "Household_name_idx" ON "Household"("name");

-- CreateIndex
CREATE INDEX "Member_branchId_status_idx" ON "Member"("branchId", "status");

-- CreateIndex
CREATE INDEX "Member_householdId_idx" ON "Member"("householdId");

-- CreateIndex
CREATE INDEX "Member_lastName_firstName_idx" ON "Member"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "MemberStatusHistory_memberId_changedAt_idx" ON "MemberStatusHistory"("memberId", "changedAt");

-- AddForeignKey
ALTER TABLE "Household" ADD CONSTRAINT "Household_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberStatusHistory" ADD CONSTRAINT "MemberStatusHistory_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
