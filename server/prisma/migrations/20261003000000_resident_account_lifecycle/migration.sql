-- Retain disabled/deleted resident accounts for the audit trail and archive.
ALTER TABLE "users"
  ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "deletedAt" TIMESTAMP(3);
