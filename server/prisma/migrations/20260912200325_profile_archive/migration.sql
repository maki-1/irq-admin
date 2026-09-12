-- AlterTable
ALTER TABLE "verification_profiles" ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "verification_profiles_archived_idx" ON "verification_profiles"("archived");
