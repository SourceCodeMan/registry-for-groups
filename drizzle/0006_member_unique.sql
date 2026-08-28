-- One membership per user per group (invite-accept vs join-approve races).
DELETE FROM "member" a USING "member" b
WHERE a.ctid < b.ctid
  AND a.organization_id = b.organization_id
  AND a.user_id = b.user_id;
--> statement-breakpoint
CREATE UNIQUE INDEX "member_org_user_uidx" ON "member" USING btree ("organization_id","user_id");
--> statement-breakpoint
-- Existing accounts were created before verification was required.
UPDATE "user" SET "email_verified" = true WHERE "email_verified" = false;
