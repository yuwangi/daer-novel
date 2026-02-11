CREATE TABLE IF NOT EXISTS "outline_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"content" text NOT NULL,
	"generation_mode" text,
	"generation_context" jsonb,
	"is_locked" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "outlines";--> statement-breakpoint
ALTER TABLE "novels" ADD COLUMN "current_outline_version" integer DEFAULT 1;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "outline_versions" ADD CONSTRAINT "outline_versions_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "novels"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
