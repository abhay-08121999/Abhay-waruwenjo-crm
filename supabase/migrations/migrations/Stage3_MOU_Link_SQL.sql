-- HealthHub Medical Leads: permanently link generated MOUs to their source lead.
-- Run in Supabase SQL Editor before deploying the updated frontend.

alter table public.agreements
  add column if not exists source_lead_id uuid;

alter table public.agreements
  add column if not exists pdf_path text;

do $$
begin
  if to_regclass('public.medical_leads') is not null
     and not exists (
       select 1 from pg_constraint
       where conname = 'agreements_source_lead_id_fkey'
         and conrelid = 'public.agreements'::regclass
     ) then
    alter table public.agreements
      add constraint agreements_source_lead_id_fkey
      foreign key (source_lead_id)
      references public.medical_leads(id)
      on delete set null;
  end if;
end $$;

create index if not exists agreements_source_lead_id_idx
  on public.agreements(source_lead_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('agreements', 'agreements', false, 20971520, array['application/pdf'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Ensure existing Storage RLS policies permit authenticated CRM users to
-- INSERT and SELECT storage.objects where bucket_id = 'agreements'.
