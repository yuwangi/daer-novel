CREATE TABLE IF NOT EXISTS "chapter_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chapter_id" uuid NOT NULL,
	"novel_id" uuid NOT NULL,
	"content" text NOT NULL,
	"title" text NOT NULL,
	"word_count" integer DEFAULT 0,
	"label" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chapter_snapshots" ADD CONSTRAINT "chapter_snapshots_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chapter_snapshots" ADD CONSTRAINT "chapter_snapshots_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "novels"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
