ALTER TABLE "completed_documents" ADD COLUMN "claimedAt" TIMESTAMP(3);

UPDATE "completed_documents"
SET "claimedAt" = "updatedAt"
WHERE LOWER("claimStatus") = 'claimed';