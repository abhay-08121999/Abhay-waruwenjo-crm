# WaruWenJo Admin CRM - Setup Guide

## Overview

The WaruWenJo Admin CRM is a medical tourism management system that integrates with the Waruwenjo.com webapp. It allows administrators to manage patients, appointments, doctors, hospitals, and more.

## Prerequisites

1. **Supabase Account**: You need a Supabase project at https://supabase.com
2. **Node.js**: Version 18+ recommended
3. **NPM or Yarn**: Package manager

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment Variables**
   
   Create or update `.env` file with your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

3. **Run Database Migrations**
   
   In your Supabase dashboard, run the SQL scripts in `supabase/migrations/` folder in order:
   - `20251125065512_*.sql` - Base tables (profiles, appointments, treatment_costs)
   - `20251126024703_*.sql` - User roles system
   - `20251127132132_*.sql` - Hospitals, doctors, consultations, patient journey
   - `20260102_admin_crm_tables.sql` - Admin CRM specific tables

4. **Create Admin User**
   
   After running migrations, create your first admin user:
   
   a. First, sign up a user through Supabase Auth (Dashboard > Authentication > Users > Add User)
   
   b. Then run this SQL in the Supabase SQL Editor:
   ```sql
   SELECT public.make_user_admin('admin@waruwenjo.com');
   ```
   Replace `admin@waruwenjo.com` with the email you used.

5. **Start Development Server**
   ```bash
   npm run dev
   ```

6. **Access Admin Portal**
   
   Navigate to `http://localhost:3000` and login with your admin credentials.

## Project Structure

```
healthhub-crm/
├── components/           # React components
│   ├── ui/              # Reusable UI components
│   ├── admin/           # Admin-specific components
│   └── *.tsx            # Page components
├── integrations/
│   └── supabase/        # Supabase client configuration
├── lib/                 # Utility functions and validations
├── services/            # API service functions
├── supabase/
│   └── migrations/      # Database migration scripts
├── App.tsx              # Main application with routing
└── index.tsx            # Entry point
```

## Database Tables

### Core Tables
- `profiles` - User profiles with patient information
- `appointments` - Patient appointment requests
- `consultations` - Scheduled consultations with doctors
- `hospitals` - Partner hospitals
- `doctors` - Doctor profiles
- `treatment_costs` - Treatment pricing
- `patient_journey` - Patient treatment journey tracking

### CRM Tables
- `user_roles` - Admin and user role assignments
- `patient_enquiries` - CRM lead management
- `crm_tasks` - Admin task management
- `crm_communications` - Communication logs
- `admin_activity_logs` - Admin action audit trail

## Authentication Flow

1. User navigates to the app
2. If not authenticated, redirected to login page
3. On login, credentials checked against Supabase Auth
4. After auth success, admin role verified from `user_roles` table
5. If admin role exists, access granted to dashboard
6. If no admin role, access denied and user signed out

## Features

### Dashboard
- Patient statistics
- Recent enquiries
- Appointment overview
- Quick actions

### Patient Management
- Patient pipeline with stages
- Enquiry management
- Document storage

### Medical Management
- Doctor profiles
- Hospital partnerships
- Treatment cost management
- Consultation scheduling

### CRM Features
- Lead automation
- Communication hub
- Task management
- Finance module

### Travel & Logistics
- Travel management
- Logistics coordination
- Visa invitation letters

## Security

- Row Level Security (RLS) enabled on all tables
- Admin-only policies for sensitive operations
- Activity logging for audit trail
- Session management via Supabase Auth

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key (public) |
| `SMTP_HOST` | Email server hostname |
| `SMTP_PORT` | Email server port |
| `SMTP_USER` | Email username |
| `SMTP_PASS` | Email password |

## Troubleshooting

### "Access denied" error
- Verify the user has admin role in `user_roles` table
- Check if RLS policies are correctly applied
- Ensure Supabase connection is working

### Login not working
- Verify env variables are correct
- Check browser console for errors
- Verify user exists in Supabase Auth

### Database errors
- Run all migrations in order
- Check Supabase logs for SQL errors
- Verify table relationships

### Patient cannot submit documents from the upload link (fails with no useful error)
- Run `supabase/patient_document_upload_policies.sql` once in the Supabase SQL Editor. This creates the public `Enquiry_docs` bucket + anon INSERT policies needed for the direct-from-browser upload.
- Confirm the patient is using the link from the email (which points at `SITE_URL` from `.env` — must be the public site, e.g. `https://admin.waruwenjo.com`, not `localhost`).
- Check the browser DevTools → Network for the failed upload request; the patient-facing page should now upload directly to `https://<project>.supabase.co/storage/v1/object/Enquiry_docs/...` and NOT `/api/upload-patient-document` (that endpoint only exists on the Vite dev server).

<｜DSML｜tool_calls>
<｜DSML｜invoke name="editor">
<｜DSML｜parameter name="new_text" string="true">### Patient cannot submit documents from the upload link (fails with no useful error)
- Run `supabase/patient_document_upload_policies.sql` once in the Supabase SQL Editor. This creates the public `Enquiry_docs` bucket + anon INSERT policies needed for the direct-from-browser upload.
- Confirm the patient is using the link from the email (which uses `SITE_URL` from `.env` — must be the public site, e.g. `https://admin.waruwenjo.com`, not `localhost`).
- Check the browser DevTools → Network for the failed upload request; the upload should now go directly to the Supabase Storage URL, not `/api/upload-patient-document` (that endpoint only exists on the local Vite dev server).

## Contributing

1. Create feature branch
2. Make changes
3. Test locally
4. Submit pull request

## License

Private - WaruWenJo Medical Tourism Platform
