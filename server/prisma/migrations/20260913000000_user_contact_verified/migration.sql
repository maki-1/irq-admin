-- Records whether a resident actually entered the OTP sent at registration.
-- Login is gated on this, so the backfill matters: defaulting every existing
-- row to false would lock out the whole barangay.
--
-- `otp` is cleared the moment a code is accepted and is left set when a
-- registration is abandoned, so a row still carrying a *verification* OTP is
-- exactly the population that never finished. Everyone else predates the gate
-- and is grandfathered in — including rows whose last code was a password
-- reset, which also proves the resident holds the registered contact.
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "contactVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "contactVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "otpAttempts" INTEGER NOT NULL DEFAULT 0;

UPDATE "users"
   SET "contactVerified"   = true,
       "contactVerifiedAt" = "createdAt"
 WHERE "otp" IS NULL
    OR "otpType" IS DISTINCT FROM 'verification';
