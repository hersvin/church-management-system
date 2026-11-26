-- The church now uses three roles: ADMIN, PASTOR, and STAFF. Staff serve through ministries.
-- Every account is kept: Super Admin becomes ADMIN (same row, so its id and users stay),
-- Branch Admins join ADMIN, and every other role joins STAFF. Permissions are refreshed by the seed.

UPDATE "Role" SET "key" = 'ADMIN', "name" = 'Admin' WHERE "key" = 'SUPER_ADMIN'
  AND NOT EXISTS (SELECT 1 FROM "Role" WHERE "key" = 'ADMIN');

UPDATE "User" SET "roleId" = (SELECT "id" FROM "Role" WHERE "key" = 'ADMIN')
  WHERE "roleId" IN (SELECT "id" FROM "Role" WHERE "key" = 'BRANCH_ADMIN')
  AND EXISTS (SELECT 1 FROM "Role" WHERE "key" = 'ADMIN');

UPDATE "User" SET "roleId" = (SELECT "id" FROM "Role" WHERE "key" = 'STAFF')
  WHERE "roleId" IN (SELECT "id" FROM "Role" WHERE "key" IN ('MINISTRY_LEADER', 'TEACHER', 'USHER', 'MEMBER'))
  AND EXISTS (SELECT 1 FROM "Role" WHERE "key" = 'STAFF');

-- Admins and pastors see every branch.
UPDATE "User" SET "branchId" = NULL
  WHERE "roleId" IN (SELECT "id" FROM "Role" WHERE "key" IN ('ADMIN', 'PASTOR'));

DELETE FROM "Role" WHERE "key" NOT IN ('ADMIN', 'PASTOR', 'STAFF')
  AND NOT EXISTS (SELECT 1 FROM "User" WHERE "User"."roleId" = "Role"."id");
