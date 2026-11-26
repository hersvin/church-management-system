-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "hourlyRate" DECIMAL(10,2);

-- A rate is never negative.
ALTER TABLE "Room" ADD CONSTRAINT "Room_hourly_rate_nonnegative" CHECK ("hourlyRate" IS NULL OR "hourlyRate" >= 0);
