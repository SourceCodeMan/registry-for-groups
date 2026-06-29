CREATE TABLE "picks" (
	"id" text PRIMARY KEY NOT NULL,
	"list_id" text NOT NULL,
	"item_id" text NOT NULL,
	"picker_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lists" ADD COLUMN "kind" text DEFAULT 'wishlist' NOT NULL;--> statement-breakpoint
ALTER TABLE "lists" ADD COLUMN "max_picks_per_member" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "picks" ADD CONSTRAINT "picks_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "picks" ADD CONSTRAINT "picks_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "picks" ADD CONSTRAINT "picks_picker_user_id_user_id_fk" FOREIGN KEY ("picker_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "picks_list_idx" ON "picks" USING btree ("list_id");--> statement-breakpoint
CREATE INDEX "picks_item_idx" ON "picks" USING btree ("item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "picks_item_picker_uidx" ON "picks" USING btree ("item_id","picker_user_id");--> statement-breakpoint
ALTER TABLE "lists" ADD CONSTRAINT "lists_kind_chk" CHECK ("lists"."kind" in ('wishlist','pick'));