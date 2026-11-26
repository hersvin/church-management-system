-- Needed for "roomId WITH =" inside a GiST exclusion constraint.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Approved bookings for the same room cannot overlap. Half-open ranges: back-to-back is allowed.
ALTER TABLE "RoomBooking"
  ADD CONSTRAINT "RoomBooking_no_overlap"
  EXCLUDE USING gist ("roomId" WITH =, tstzrange("startsAt", "endsAt", '[)') WITH &&)
  WHERE ("status" = 'APPROVED');

ALTER TABLE "RoomBooking" ADD CONSTRAINT "RoomBooking_valid_range" CHECK ("endsAt" > "startsAt");
ALTER TABLE "Event" ADD CONSTRAINT "Event_valid_range" CHECK ("endsAt" > "startsAt");

-- One active registration per member per event.
CREATE UNIQUE INDEX "EventRegistration_active_member_unique"
  ON "EventRegistration" ("eventId", "memberId")
  WHERE "cancelledAt" IS NULL AND "memberId" IS NOT NULL;
