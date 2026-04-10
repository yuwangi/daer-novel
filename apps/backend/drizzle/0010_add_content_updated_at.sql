ALTER TABLE "chapters" ADD COLUMN "content_updated_at" timestamp;--> statement-breakpoint

-- Initialize content_updated_at with updated_at for existing chapters that have content
UPDATE "chapters" SET "content_updated_at" = "updated_at" WHERE "content" IS NOT NULL AND "content" != '';
