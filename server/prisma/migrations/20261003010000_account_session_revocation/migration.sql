ALTER TABLE "users" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "admins" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- All writers share these tables. Changes made by another service or an
-- operator must also revoke sessions. GREATEST avoids double increments when
-- an application already increments the version in the same update.
CREATE FUNCTION revoke_user_sessions() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."password" IS DISTINCT FROM OLD."password"
     OR NEW."active" IS DISTINCT FROM OLD."active"
     OR NEW."deletedAt" IS DISTINCT FROM OLD."deletedAt" THEN
    NEW."sessionVersion" := GREATEST(NEW."sessionVersion", OLD."sessionVersion" + 1);
    NEW."resetToken" := NULL;
    NEW."resetTokenExpires" := NULL;
    -- Reclaiming an abandoned registration sets a new password AND a fresh
    -- verification code. Preserve that new code, but never an earlier code.
    IF NEW."otp" IS NOT DISTINCT FROM OLD."otp"
       OR NEW."active" IS DISTINCT FROM OLD."active"
       OR NEW."deletedAt" IS DISTINCT FROM OLD."deletedAt" THEN
      NEW."otp" := NULL;
      NEW."otpExpires" := NULL;
      NEW."otpType" := NULL;
      NEW."otpAttempts" := 0;
    END IF;
    DELETE FROM "otp_codes" WHERE "userId" = OLD."id";
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER users_revoke_sessions
BEFORE UPDATE OF "password", "active", "deletedAt" ON "users"
FOR EACH ROW EXECUTE FUNCTION revoke_user_sessions();

CREATE FUNCTION revoke_admin_sessions() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."password" IS DISTINCT FROM OLD."password"
     OR NEW."active" IS DISTINCT FROM OLD."active" THEN
    NEW."sessionVersion" := GREATEST(NEW."sessionVersion", OLD."sessionVersion" + 1);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER admins_revoke_sessions
BEFORE UPDATE OF "password", "active" ON "admins"
FOR EACH ROW EXECUTE FUNCTION revoke_admin_sessions();
