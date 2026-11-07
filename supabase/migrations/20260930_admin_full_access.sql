-- 1. Give the 'admin' role the same "*" wildcard 'super_admin' already has,
--    via the existing permissions table.
UPDATE public.crm_role_permissions
SET permissions = permissions || '{"*": true}'::jsonb
WHERE role = 'admin';

-- 2. Also hardcode it directly into crm_has_permission(), so 'admin' and
--    'super_admin' always pass every permission check — including
--    create_medical_case_from_enquiry()'s cases.write/leads.write check —
--    even if crm_role_permissions is edited again later and the "*" above
--    gets removed by mistake.
CREATE OR REPLACE FUNCTION public.crm_has_permission(_user_id UUID, _permission TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role IN ('admin', 'super_admin')
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.crm_role_permissions rp ON rp.role = ur.role
    WHERE ur.user_id = _user_id
      AND (COALESCE((rp.permissions ->> '*')::boolean, false)
        OR COALESCE((rp.permissions ->> _permission)::boolean, false))
  );
$$;