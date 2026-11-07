-- Medical Partner Leads: Stage 1 Partnership Inquiry fields
-- Run in Supabase SQL Editor after reviewing against your current medical_leads schema.
alter table public.medical_leads
  add column if not exists partner_type text,
  add column if not exists source text,
  add column if not exists source_reference text,
  add column if not exists campaign_name text,
  add column if not exists target_geography text,
  add column if not exists owner_name text,
  add column if not exists data_use_permission boolean not null default false,
  add column if not exists website text,
  add column if not exists country text,
  add column if not exists city text,
  add column if not exists address text,
  add column if not exists notes text,
  add column if not exists pipeline_stage text not null default 'Imported';

-- Keep existing application columns (full_name, company_name, email, phone,
-- industry, status, estimated_value, created_at) unchanged.
