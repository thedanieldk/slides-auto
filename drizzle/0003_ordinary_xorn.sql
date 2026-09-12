ALTER TABLE "hooks" ADD COLUMN "user_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "product_profiles" ADD COLUMN "user_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "slideshows" ADD COLUMN "user_id" uuid NOT NULL;