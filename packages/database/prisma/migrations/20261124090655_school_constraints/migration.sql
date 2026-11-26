-- One active enrollment per student per class; completed and dropped rows stay as history.
CREATE UNIQUE INDEX "Enrollment_active_unique"
  ON "Enrollment" ("classId", "memberId")
  WHERE "status" = 'ENROLLED';

ALTER TABLE "SchoolTerm" ADD CONSTRAINT "SchoolTerm_valid_range" CHECK ("endsOn" > "startsOn");
ALTER TABLE "SchoolClass" ADD CONSTRAINT "SchoolClass_meeting_day" CHECK ("meetingDay" IS NULL OR "meetingDay" BETWEEN 0 AND 6);
