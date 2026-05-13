-- ═══════════════════════════════════════════════════════════════════════════
-- ITAB — Render PostgreSQL (manual or one-off run)
-- Purpose: document + apply schema used by agent KYC / document uploads and
--          admin "Applications" dashboard (see server.js POST /api/agent-applications).
-- Safe to run multiple times (IF NOT EXISTS).
--
-- How to run on Render:
--   1) Dashboard → your PostgreSQL → Connect → "External Database URL" (or Shell)
--   2) psql "$DATABASE_URL" -f sql/render_agent_application_columns.sql
--   OR use Render's "psql" button / shell and paste this file.
--
-- Preferred automated path (from itab-backend with DATABASE_URL set):
--   node migrate.js
--   (includes these ALTERs plus all other patches)
-- ═══════════════════════════════════════════════════════════════════════════

-- National ID image or scan as base64 data URL (large TEXT; keep an eye on DB size in production).
ALTER TABLE agent_applications
  ADD COLUMN IF NOT EXISTS national_id_doc TEXT;

COMMENT ON COLUMN agent_applications.national_id_doc IS
  'Optional: National ID image as data URL or URL string; submitted with landlord/agent/property_manager applications.';

-- Supporting files (certificates, deeds, etc.) as JSON array of { name, dataUrl, type }.
ALTER TABLE agent_applications
  ADD COLUMN IF NOT EXISTS additional_docs JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN agent_applications.additional_docs IS
  'JSON array of extra uploads from registration KYC step; shown to admin in Applications UI.';
