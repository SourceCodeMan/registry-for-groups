CREATE TABLE "gift_notifications" (
	"user_id" text PRIMARY KEY NOT NULL,
	"last_sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gift_notifications" ADD CONSTRAINT "gift_notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;