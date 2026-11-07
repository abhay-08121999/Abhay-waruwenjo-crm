-- Adds editable agreement document content to the existing repository.
-- Run this in the Supabase SQL Editor before saving MOU templates from the UI.
ALTER TABLE public.agreements
ADD COLUMN IF NOT EXISTS document_content TEXT;
