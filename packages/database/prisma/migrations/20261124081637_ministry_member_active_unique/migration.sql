-- One active roster entry per person per ministry. Past entries (leftAt set) are kept as history.
CREATE UNIQUE INDEX "MinistryMember_active_unique"
  ON "MinistryMember" ("ministryId", "memberId")
  WHERE "leftAt" IS NULL;
