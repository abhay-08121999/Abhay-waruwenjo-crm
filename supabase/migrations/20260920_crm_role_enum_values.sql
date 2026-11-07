-- Extend the existing CRM role enum before the role-access migration.
-- Keep this migration separate because PostgreSQL may require enum changes to commit first.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'bdm';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'in_house_doctor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'specialist_doctor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'cdm';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'waru_buddy';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'unassigned';
