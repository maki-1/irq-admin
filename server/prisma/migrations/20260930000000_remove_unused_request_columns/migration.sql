-- These legacy request fields have no active write path and contain no values.
ALTER TABLE "requests"
  DROP COLUMN "controlNumber",
  DROP COLUMN "freeDocumentProof";
