CREATE TABLE "join_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"decided_at" timestamp,
	"decided_by_user_id" text,
	CONSTRAINT "join_requests_status_chk" CHECK ("join_requests"."status" in ('pending','approved','denied'))
);
--> statement-breakpoint
ALTER TABLE "lists" ALTER COLUMN "organization_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "group_invites" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_decided_by_user_id_user_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "join_requests_org_idx" ON "join_requests" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "join_requests_org_user_uidx" ON "join_requests" USING btree ("organization_id","user_id");