-- A check-in belongs to exactly one service or one event.
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_one_target" CHECK (num_nonnulls("serviceId", "eventId") = 1);

-- A check-in names a member or a guest, never both.
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_one_person" CHECK (num_nonnulls("memberId", "guestName") = 1);

-- Kids check-in needs a member child, one guardian, and a pickup code.
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_child_guarded" CHECK (
  "kind" <> 'CHILD'
  OR ("memberId" IS NOT NULL AND "pickupCode" IS NOT NULL AND num_nonnulls("guardianMemberId", "guardianName") = 1)
);

ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_attempts_nonnegative" CHECK ("failedPickupAttempts" >= 0);
ALTER TABLE "Service" ADD CONSTRAINT "Service_headcount_nonnegative" CHECK ("headcount" IS NULL OR "headcount" >= 0);

-- A member checks in once per service and once per event.
CREATE UNIQUE INDEX "CheckIn_service_member_unique" ON "CheckIn" ("serviceId", "memberId")
  WHERE "serviceId" IS NOT NULL AND "memberId" IS NOT NULL;
CREATE UNIQUE INDEX "CheckIn_event_member_unique" ON "CheckIn" ("eventId", "memberId")
  WHERE "eventId" IS NOT NULL AND "memberId" IS NOT NULL;

-- Pickup codes are unique among children still in care at the same gathering.
CREATE UNIQUE INDEX "CheckIn_service_code_unique" ON "CheckIn" ("serviceId", "pickupCode")
  WHERE "serviceId" IS NOT NULL AND "pickupCode" IS NOT NULL AND "checkedOutAt" IS NULL;
CREATE UNIQUE INDEX "CheckIn_event_code_unique" ON "CheckIn" ("eventId", "pickupCode")
  WHERE "eventId" IS NOT NULL AND "pickupCode" IS NOT NULL AND "checkedOutAt" IS NULL;
