CREATE TABLE IF NOT EXISTS "plot_sandboxes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" uuid NOT NULL,
	"title" text NOT NULL,
	"premise" text NOT NULL,
	"content" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "plot_sandboxes" ADD CONSTRAINT "plot_sandboxes_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "novels"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
