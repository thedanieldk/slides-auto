CREATE TABLE "hooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid,
	"framework_id" text NOT NULL,
	"text" text NOT NULL,
	"generated_copy" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"niche" text NOT NULL,
	"value_proposition" text NOT NULL,
	"source_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slideshows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"theme_id" text NOT NULL,
	"active_slide_id" text NOT NULL,
	"slides" jsonb NOT NULL,
	"source_hook_id" uuid,
	"product_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hooks" ADD CONSTRAINT "hooks_product_id_product_profiles_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slideshows" ADD CONSTRAINT "slideshows_source_hook_id_hooks_id_fk" FOREIGN KEY ("source_hook_id") REFERENCES "public"."hooks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slideshows" ADD CONSTRAINT "slideshows_product_id_product_profiles_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product_profiles"("id") ON DELETE set null ON UPDATE no action;