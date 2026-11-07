-- CRM role-based access control.
-- Run 20260920_crm_role_enum_values.sql before this migration.
-- Roles: one super_admin and one admin; multiple operational users are supported.

CREATE TABLE IF NOT EXISTS public.crm_user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  job_title TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_role_permissions (
  role public.app_role PRIMARY KEY,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.crm_role_permissions(role, permissions, description) VALUES
  ('super_admin', '{"*": true}'::jsonb, 'Full CRM access and role administration'),
  ('admin', '{"crm.read": true, "crm.write": true, "users.manage": true, "reports.read": true}'::jsonb, 'CRM administration and user management'),
  ('bdm', '{"crm.read": true, "leads.write": true, "communications.write": true, "payments.write": true}'::jsonb, 'Business development and lead conversion'),
  ('in_house_doctor', '{"crm.read": true, "clinical.write": true, "documents.read": true}'::jsonb, 'In-house doctor clinical workflow'),
  ('specialist_doctor', '{"crm.read": true, "clinical.write": true, "consultations.write": true}'::jsonb, 'Specialist consultation workflow'),
  ('cdm', '{"crm.read": true, "cases.write": true, "handover.write": true}'::jsonb, 'Case delivery management and handover ownership'),
  ('waru_buddy', '{"crm.read": true, "cases.write": true, "handover.write": true, "communications.write": true}'::jsonb, 'Patient support and case ownership'),
  ('unassigned', '{}'::jsonb, 'New account awaiting role assignment')
ON CONFLICT (role) DO UPDATE SET permissions = EXCLUDED.permissions, description = EXCLUDED.description, updated_at = now();

-- Keep the singleton leadership roles enforceable at the database level.
CREATE UNIQUE INDEX IF NOT EXISTS one_super_admin_only ON public.user_roles(role) WHERE role = 'super_admin';
CREATE UNIQUE INDEX IF NOT EXISTS one_admin_only ON public.user_roles(role) WHERE role = 'admin';

CREATE OR REPLACE FUNCTION public.crm_has_any_role(_user_id UUID, _roles public.app_role[])
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles));
$$;

CREATE OR REPLACE FUNCTION public.crm_has_permission(_user_id UUID, _permission TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.crm_role_permissions rp ON rp.role = ur.role
    WHERE ur.user_id = _user_id
      AND (COALESCE((rp.permissions ->> '*')::boolean, false)
        OR COALESCE((rp.permissions ->> _permission)::boolean, false))
  );
$$;

CREATE OR REPLACE FUNCTION public.crm_sync_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.crm_user_profiles(user_id, email, full_name)
  VALUES (NEW.id, COALESCE(NEW.email, ''), COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''))
  ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email;
  INSERT INTO public.user_roles(user_id, role)
  VALUES (NEW.id, 'unassigned')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_sync_new_auth_user ON auth.users;
CREATE TRIGGER crm_sync_new_auth_user
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.crm_sync_new_auth_user();

ALTER TABLE public.crm_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "CRM users view their own profile" ON public.crm_user_profiles;
CREATE POLICY "CRM users view their own profile" ON public.crm_user_profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "CRM managers view all profiles" ON public.crm_user_profiles;
CREATE POLICY "CRM managers view all profiles" ON public.crm_user_profiles
  FOR SELECT TO authenticated USING (public.crm_has_any_role(auth.uid(), ARRAY['super_admin','admin']::public.app_role[]));
DROP POLICY IF EXISTS "CRM managers update profiles" ON public.crm_user_profiles;
CREATE POLICY "CRM managers update profiles" ON public.crm_user_profiles
  FOR UPDATE TO authenticated
  USING (public.crm_has_any_role(auth.uid(), ARRAY['super_admin','admin']::public.app_role[]))
  WITH CHECK (public.crm_has_any_role(auth.uid(), ARRAY['super_admin','admin']::public.app_role[]));

DROP POLICY IF EXISTS "CRM users view role permissions" ON public.crm_role_permissions;
CREATE POLICY "CRM users view role permissions" ON public.crm_role_permissions
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Only super admin manages role permissions" ON public.crm_role_permissions;
CREATE POLICY "Only super admin manages role permissions" ON public.crm_role_permissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "CRM managers view all role assignments" ON public.user_roles;
CREATE POLICY "CRM managers view all role assignments" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.crm_has_any_role(auth.uid(), ARRAY['super_admin','admin']::public.app_role[]));
DROP POLICY IF EXISTS "CRM managers assign roles" ON public.user_roles;
CREATE POLICY "CRM managers assign roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.crm_has_any_role(auth.uid(), ARRAY['super_admin','admin']::public.app_role[]));
DROP POLICY IF EXISTS "CRM managers change roles" ON public.user_roles;
CREATE POLICY "CRM managers change roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.crm_has_any_role(auth.uid(), ARRAY['super_admin','admin']::public.app_role[]))
  WITH CHECK (public.crm_has_any_role(auth.uid(), ARRAY['super_admin','admin']::public.app_role[]));
DROP POLICY IF EXISTS "CRM managers remove roles" ON public.user_roles;
CREATE POLICY "CRM managers remove roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.crm_has_any_role(auth.uid(), ARRAY['super_admin','admin']::public.app_role[]));

-- Existing admin-only CRM policies can be broadened by future table migrations using crm_has_permission().
COMMENT ON TABLE public.crm_user_profiles IS 'CRM staff metadata. Authentication credentials remain in Supabase Auth.';
COMMENT ON TABLE public.crm_role_permissions IS 'Permission matrix for CRM roles.';
COMMENT ON COLUMN public.user_roles.role IS 'super_admin/admin are singleton leadership roles; operational roles may have multiple users.';

-- Backfill metadata for users already present before this migration.
INSERT INTO public.crm_user_profiles(user_id, email, full_name)
SELECT id, COALESCE(email, ''), COALESCE(raw_user_meta_data ->> 'full_name', '')
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles(user_id, role)
SELECT id, 'unassigned'::public.app_role FROM auth.users
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.users.id)
ON CONFLICT (user_id, role) DO NOTHING;

-- Replace the old bootstrap helper with a role-aware helper.
CREATE OR REPLACE FUNCTION public.assign_crm_role(user_email TEXT, target_role public.app_role)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_user_id UUID;
BEGIN
  IF NOT public.crm_has_any_role(auth.uid(), ARRAY['super_admin','admin']::public.app_role[]) THEN
    RAISE EXCEPTION 'Only CRM administrators can assign roles';
  END IF;
  SELECT id INTO target_user_id FROM auth.users WHERE lower(email) = lower(user_email);
  IF target_user_id IS NULL THEN RAISE EXCEPTION 'User with email % not found', user_email; END IF;
  DELETE FROM public.user_roles WHERE user_id = target_user_id;
  INSERT INTO public.user_roles(user_id, role) VALUES (target_user_id, target_role);
END;
$$;
REVOKE ALL ON FUNCTION public.assign_crm_role(TEXT, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_crm_role(TEXT, public.app_role) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_crm_user_profile_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS crm_user_profiles_updated_at ON public.crm_user_profiles;
CREATE TRIGGER crm_user_profiles_updated_at BEFORE UPDATE ON public.crm_user_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_crm_user_profile_timestamp();

-- Recommended first setup after applying this migration:
-- SELECT public.assign_crm_role('your-super-admin@email.com', 'super_admin');
-- SELECT public.assign_crm_role('your-admin@email.com', 'admin');
REVOKE ALL ON FUNCTION public.crm_sync_new_auth_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_has_any_role(UUID, public.app_role[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_has_permission(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_has_any_role(UUID, public.app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_has_permission(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_sync_new_auth_user() TO service_role;

-- NOTE: Supabase may require enum additions to be committed before later statements
-- in a separate migration if your migration runner wraps the complete file in one transaction.

-- Core CRM data access for operational roles. Existing admin policies remain valid;
-- these policies add least-privilege access for assigned staff roles.
DROP POLICY IF EXISTS "Assigned CRM staff read patient enquiries" ON public.patient_enquiries;
CREATE POLICY "Assigned CRM staff read patient enquiries" ON public.patient_enquiries
  FOR SELECT TO authenticated USING (public.crm_has_permission(auth.uid(), 'crm.read'));
DROP POLICY IF EXISTS "Assigned CRM staff update patient enquiries" ON public.patient_enquiries;
CREATE POLICY "Assigned CRM staff update patient enquiries" ON public.patient_enquiries
  FOR UPDATE TO authenticated
  USING (public.crm_has_permission(auth.uid(), 'leads.write'))
  WITH CHECK (public.crm_has_permission(auth.uid(), 'leads.write'));

DROP POLICY IF EXISTS "Assigned CRM staff read medical cases" ON public.medical_cases;
CREATE POLICY "Assigned CRM staff read medical cases" ON public.medical_cases
  FOR SELECT TO authenticated USING (public.crm_has_permission(auth.uid(), 'crm.read'));
DROP POLICY IF EXISTS "Assigned CRM staff update medical cases" ON public.medical_cases;
CREATE POLICY "Assigned CRM staff update medical cases" ON public.medical_cases
  FOR UPDATE TO authenticated
  USING (public.crm_has_permission(auth.uid(), 'cases.write'))
  WITH CHECK (public.crm_has_permission(auth.uid(), 'cases.write'));

DROP POLICY IF EXISTS "Assigned CRM staff read tasks" ON public.crm_tasks;
CREATE POLICY "Assigned CRM staff read tasks" ON public.crm_tasks
  FOR SELECT TO authenticated USING (public.crm_has_permission(auth.uid(), 'crm.read'));
DROP POLICY IF EXISTS "Assigned CRM staff manage tasks" ON public.crm_tasks;
CREATE POLICY "Assigned CRM staff manage tasks" ON public.crm_tasks
  FOR ALL TO authenticated
  USING (public.crm_has_permission(auth.uid(), 'crm.write'))
  WITH CHECK (public.crm_has_permission(auth.uid(), 'crm.write'));

DROP POLICY IF EXISTS "Assigned CRM staff read communications" ON public.crm_communications;
CREATE POLICY "Assigned CRM staff read communications" ON public.crm_communications
  FOR SELECT TO authenticated USING (public.crm_has_permission(auth.uid(), 'crm.read'));
DROP POLICY IF EXISTS "Assigned CRM staff write communications" ON public.crm_communications;
CREATE POLICY "Assigned CRM staff write communications" ON public.crm_communications
  FOR INSERT TO authenticated
  WITH CHECK (public.crm_has_permission(auth.uid(), 'communications.write'));

CREATE OR REPLACE FUNCTION public.crm_enforce_leadership_assignment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role IN ('admin'::public.app_role, 'super_admin'::public.app_role)
     AND auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only Super Admin can assign leadership roles';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS crm_enforce_leadership_assignment ON public.user_roles;
CREATE TRIGGER crm_enforce_leadership_assignment
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.crm_enforce_leadership_assignment();
