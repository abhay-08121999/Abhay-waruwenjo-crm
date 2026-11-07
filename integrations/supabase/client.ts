/**
 * Supabase Client Configuration
 * This file creates and exports the Supabase client using environment variables.
 */

import { createClient } from '@supabase/supabase-js';

// Get environment variables for Supabase connection
// Get environment variables for Supabase connection
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim();
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

// Debug configuration (verbose)
console.log('Supabase Environment Audit:', {
    url: SUPABASE_URL ? `Defined (${SUPABASE_URL.length} chars)` : 'Missing',
    anonKey: SUPABASE_ANON_KEY ? `Defined (${SUPABASE_ANON_KEY.length} chars)` : 'Missing',
    hasQuotes: SUPABASE_ANON_KEY ? (SUPABASE_ANON_KEY.includes('"') || SUPABASE_ANON_KEY.includes("'")) : false,
    mode: import.meta.env.MODE
});

// Validate configuration
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('CRITICAL: Missing Supabase configuration!');
    console.error('Check your .env or .env.local file. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.');
} else if (SUPABASE_ANON_KEY.includes('"') || SUPABASE_ANON_KEY.includes("'")) {
    console.warn('WARNING: Supabase API Key seems to contain literal quotes. This will cause authentication to fail.');
}

// Create and export the Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
    },
});

// Database types for TypeScript
export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string;
                    full_name: string;
                    email: string;
                    phone: string | null;
                    country: string | null;
                    medical_history: string | null;
                    patient_id: string | null;
                    role: 'admin' | 'patient_coordinator' | 'in_house_doctor' | 'medical_manager';
                    is_active: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id: string;
                    full_name: string;
                    email: string;
                    phone?: string | null;
                    country?: string | null;
                    medical_history?: string | null;
                    patient_id?: string | null;
                    role?: 'admin' | 'patient_coordinator' | 'in_house_doctor' | 'medical_manager';
                    is_active?: boolean;
                };
                Update: {
                    full_name?: string;
                    email?: string;
                    phone?: string | null;
                    country?: string | null;
                    medical_history?: string | null;
                    patient_id?: string | null;
                    role?: 'admin' | 'patient_coordinator' | 'in_house_doctor' | 'medical_manager';
                    is_active?: boolean;
                };
            };
            user_roles: {
                Row: {
                    id: string;
                    user_id: string;
                    role: 'admin' | 'patient_coordinator' | 'in_house_doctor' | 'medical_manager';
                    created_at: string;
                };
                Insert: {
                    user_id: string;
                    role: 'admin' | 'patient_coordinator' | 'in_house_doctor' | 'medical_manager';
                };
                Update: {
                    role?: 'admin' | 'patient_coordinator' | 'in_house_doctor' | 'medical_manager';
                };
            };
            hospitals: {
                Row: {
                    id: string;
                    name: string;
                    city: string;
                    address: string;
                    description: string | null;
                    accreditation: string | null;
                    image_url: string | null;
                    contact_email: string | null;
                    contact_phone: string | null;
                    facilities: any[];
                    rating: number | null;
                    bed_count: number | null;
                    type: string | null;
                    country: string | null;
                    is_active: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    name: string;
                    city: string;
                    address: string;
                    description?: string | null;
                    accreditation?: string | null;
                    image_url?: string | null;
                    contact_email?: string | null;
                    contact_phone?: string | null;
                    facilities?: any[];
                    rating?: number | null;
                    bed_count?: number | null;
                    type?: string | null;
                    country?: string | null;
                    is_active?: boolean;
                };
                Update: {
                    name?: string;
                    city?: string;
                    address?: string;
                    description?: string | null;
                    accreditation?: string | null;
                    image_url?: string | null;
                    contact_email?: string | null;
                    contact_phone?: string | null;
                    facilities?: any[];
                    rating?: number | null;
                    bed_count?: number | null;
                    type?: string | null;
                    country?: string | null;
                    is_active?: boolean;
                };
            };
            doctors: {
                Row: {
                    id: string;
                    name: string;
                    specialty: string;
                    bio: string | null;
                    image_url: string | null;
                    hospital_id: string | null;
                    languages: string[];
                    experience_years: number | null;
                    consultation_fee: number | null;
                    available_for_online: boolean;
                    is_active: boolean;
                    qualifications: string | null;
                    availability: any;
                    rating: number | null;
                    email: string | null;
                    phone: string | null;
                    doctor_type: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    name: string;
                    specialty: string;
                    bio?: string | null;
                    image_url?: string | null;
                    hospital_id?: string | null;
                    languages?: string[];
                    experience_years?: number | null;
                    consultation_fee?: number | null;
                    available_for_online?: boolean;
                    is_active?: boolean;
                    qualifications?: string | null;
                    availability?: any;
                    rating?: number | null;
                    email?: string | null;
                    phone?: string | null;
                    doctor_type?: string | null;
                };
                Update: {
                    name?: string;
                    specialty?: string;
                    bio?: string | null;
                    image_url?: string | null;
                    hospital_id?: string | null;
                    languages?: string[];
                    experience_years?: number | null;
                    consultation_fee?: number | null;
                    available_for_online?: boolean;
                    is_active?: boolean;
                    qualifications?: string | null;
                    availability?: any;
                    rating?: number | null;
                    email?: string | null;
                    phone?: string | null;
                    doctor_type?: string | null;
                };
            };
            treatment_costs: {
                Row: {
                    id: string;
                    treatment_name: string;
                    base_cost: number;
                    description: string | null;
                    duration_days: number | null;
                    created_at: string;
                };
                Insert: {
                    treatment_name: string;
                    base_cost: number;
                    description?: string | null;
                    duration_days?: number | null;
                };
                Update: {
                    treatment_name?: string;
                    base_cost?: number;
                    description?: string | null;
                    duration_days?: number | null;
                };
            };
            appointments: {
                Row: {
                    id: string;
                    user_id: string | null;
                    full_name: string;
                    email: string;
                    phone: string;
                    country: string;
                    treatment_type: string;
                    preferred_date: string;
                    message: string | null;
                    status: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    user_id?: string | null;
                    full_name: string;
                    email: string;
                    phone: string;
                    country: string;
                    treatment_type: string;
                    preferred_date: string;
                    message?: string | null;
                    status?: string;
                };
                Update: {
                    full_name?: string;
                    email?: string;
                    phone?: string;
                    country?: string;
                    treatment_type?: string;
                    preferred_date?: string;
                    message?: string | null;
                    status?: string;
                };
            };
            consultations: {
                Row: {
                    id: string;
                    user_id: string;
                    doctor_id: string;
                    consultation_type: 'online' | 'in_person';
                    scheduled_at: string;
                    status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
                    notes: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    user_id: string;
                    doctor_id: string;
                    consultation_type: 'online' | 'in_person';
                    scheduled_at: string;
                    status?: 'pending' | 'confirmed' | 'completed' | 'cancelled';
                    notes?: string | null;
                };
                Update: {
                    consultation_type?: 'online' | 'in_person';
                    scheduled_at?: string;
                    status?: 'pending' | 'confirmed' | 'completed' | 'cancelled';
                    notes?: string | null;
                };
            };
            patient_journey: {
                Row: {
                    id: string;
                    user_id: string;
                    appointment_id: string | null;
                    assigned_doctor: string | null;
                    status: string;
                    current_stage: string;
                    visa_complete: boolean;
                    travel_complete: boolean;
                    treatment_complete: boolean;
                    payment_complete: boolean;
                    postop_complete: boolean;
                    return_complete: boolean;
                    followup_complete: boolean;
                    stage_details: any;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    user_id: string;
                    appointment_id?: string | null;
                    assigned_doctor?: string | null;
                    status?: string;
                    current_stage?: string;
                    visa_complete?: boolean;
                    travel_complete?: boolean;
                    treatment_complete?: boolean;
                    payment_complete?: boolean;
                    postop_complete?: boolean;
                    return_complete?: boolean;
                    followup_complete?: boolean;
                    stage_details?: any;
                };
                Update: {
                    assigned_doctor?: string | null;
                    status?: string;
                    current_stage?: string;
                    visa_complete?: boolean;
                    travel_complete?: boolean;
                    treatment_complete?: boolean;
                    payment_complete?: boolean;
                    postop_complete?: boolean;
                    return_complete?: boolean;
                    followup_complete?: boolean;
                    stage_details?: any;
                };
            };
            patient_enquiries: {
                Row: {
                    id: string;
                    full_name: string;
                    email: string;
                    phone: string | null;
                    country: string | null;
                    treatment_interest: string | null;
                    message: string | null;
                    source: string;
                    status: string;
                    assigned_to: string | null;
                    notes: string | null;
                    budget_range: string | null;
                    preferred_date: string | null;
                    urgency: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    full_name: string;
                    email: string;
                    phone?: string | null;
                    country?: string | null;
                    treatment_interest?: string | null;
                    message?: string | null;
                    source?: string;
                    status?: string;
                    assigned_to?: string | null;
                    notes?: string | null;
                    budget_range?: string | null;
                    preferred_date?: string | null;
                    urgency?: string;
                };
                Update: {
                    full_name?: string;
                    email?: string;
                    phone?: string | null;
                    country?: string | null;
                    treatment_interest?: string | null;
                    message?: string | null;
                    source?: string;
                    status?: string;
                    assigned_to?: string | null;
                    notes?: string | null;
                    budget_range?: string | null;
                    preferred_date?: string | null;
                    urgency?: string;
                };
            };
            crm_tasks: {
                Row: {
                    id: string;
                    title: string;
                    description: string | null;
                    assigned_to: string | null;
                    related_entity_type: string | null;
                    related_entity_id: string | null;
                    priority: string;
                    status: string;
                    due_date: string | null;
                    completed_at: string | null;
                    created_by: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    title: string;
                    description?: string | null;
                    assigned_to?: string | null;
                    related_entity_type?: string | null;
                    related_entity_id?: string | null;
                    priority?: string;
                    status?: string;
                    due_date?: string | null;
                    created_by?: string | null;
                };
                Update: {
                    title?: string;
                    description?: string | null;
                    assigned_to?: string | null;
                    priority?: string;
                    status?: string;
                    due_date?: string | null;
                    completed_at?: string | null;
                };
            };
            crm_communications: {
                Row: {
                    id: string;
                    entity_type: string;
                    entity_id: string;
                    channel: string;
                    direction: string;
                    subject: string | null;
                    content: string;
                    status: string;
                    sent_by: string | null;
                    created_at: string;
                };
                Insert: {
                    entity_type: string;
                    entity_id: string;
                    channel: string;
                    direction: string;
                    subject?: string | null;
                    content: string;
                    status?: string;
                    sent_by?: string | null;
                };
                Update: {
                    subject?: string | null;
                    content?: string;
                    status?: string;
                };
            };
            admin_activity_logs: {
                Row: {
                    id: string;
                    admin_id: string;
                    action: string;
                    entity_type: string;
                    entity_id: string | null;
                    details: any;
                    ip_address: string | null;
                    user_agent: string | null;
                    created_at: string;
                };
                Insert: {
                    admin_id: string;
                    action: string;
                    entity_type: string;
                    entity_id?: string | null;
                    details?: any;
                    ip_address?: string | null;
                    user_agent?: string | null;
                };
                Update: {
                    details?: any;
                };
            };
            travel_bookings: {
                Row: {
                    id: string;
                    patient_id: string;
                    patient_name: string;
                    type: string;
                    provider: string;
                    reference: string | null;
                    date: string | null;
                    status: string;
                    details: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    patient_id: string;
                    patient_name: string;
                    type: string;
                    provider: string;
                    reference?: string | null;
                    date?: string | null;
                    status?: string;
                    details?: string | null;
                };
                Update: {
                    patient_name?: string;
                    type?: string;
                    provider?: string;
                    reference?: string | null;
                    date?: string | null;
                    status?: string;
                    details?: string | null;
                };
            };
            finance_records: {
                Row: {
                    id: string;
                    patient_id: string | null;
                    entity_name: string;
                    type: string;
                    amount: number;
                    status: string;
                    date: string;
                    category: string;
                    created_at: string;
                };
                Insert: {
                    patient_id?: string | null;
                    entity_name: string;
                    type: string;
                    amount: number;
                    status?: string;
                    date: string;
                    category: string;
                };
                Update: {
                    entity_name?: string;
                    type?: string;
                    amount?: number;
                    status?: string;
                    date?: string;
                    category?: string;
                };
            };
            inventory_items: {
                Row: {
                    id: string;
                    name: string;
                    type: string;
                    stock: number;
                    unit: string;
                    sku: string | null;
                    created_at: string;
                };
                Insert: {
                    name: string;
                    type: string;
                    stock?: number;
                    unit?: string;
                    sku?: string | null;
                };
                Update: {
                    name?: string;
                    type?: string;
                    stock?: number;
                    unit?: string;
                    sku?: string | null;
                };
            };
            expenses: {
                Row: {
                    id: string;
                    category: string;
                    amount: number;
                    date: string;
                    status: string;
                    description: string | null;
                    created_at: string;
                };
                Insert: {
                    category: string;
                    amount: number;
                    date: string;
                    status?: string;
                    description?: string | null;
                };
                Update: {
                    category?: string;
                    amount?: number;
                    date?: string;
                    status?: string;
                    description?: string | null;
                };
            };
            transport_teams: {
                Row: {
                    id: string;
                    name: string;
                    vehicle: string | null;
                    status: string;
                    contact: string | null;
                    created_at: string;
                };
                Insert: {
                    name: string;
                    vehicle?: string | null;
                    status?: string;
                    contact?: string | null;
                };
                Update: {
                    name?: string;
                    vehicle?: string | null;
                    status?: string;
                    contact?: string | null;
                };
            };
            patient_arrivals: {
                Row: {
                    id: string;
                    patient_id: string;
                    patient_name: string | null;
                    flight_number: string | null;
                    carrier: string | null;
                    arrival_date: string | null;
                    arrival_time: string | null;
                    country_code: string | null;
                    status: string;
                    assigned_transport_id: string | null;
                    notes: string | null;
                    created_at: string;
                };
                Insert: {
                    patient_id: string;
                    patient_name?: string | null;
                    flight_number?: string | null;
                    carrier?: string | null;
                    arrival_date?: string | null;
                    arrival_time?: string | null;
                    country_code?: string | null;
                    status?: string;
                    assigned_transport_id?: string | null;
                    notes?: string | null;
                };
                Update: {
                    status?: string;
                    assigned_transport_id?: string | null;
                    notes?: string | null;
                };
            };
            agreements: {
                Row: {
                    id: string;
                    partner_name: string;
                    type: string;
                    status: string;
                    valid_until: string | null;
                    version: string | null;
                    created_at: string;
                };
                Insert: {
                    partner_name: string;
                    type: string;
                    status?: string;
                    valid_until?: string | null;
                    version?: string | null;
                };
                Update: {
                    status?: string;
                    valid_until?: string | null;
                    version?: string | null;
                };
            };
            visa_invitations: {
                Row: {
                    id: string;
                    traveler_name: string;
                    passport_number: string;
                    nationality: string | null;
                    purpose: string | null;
                    start_date: string | null;
                    end_date: string | null;
                    status: string;
                    verification_code: string | null;
                    content: string | null;
                    created_at: string;
                };
                Insert: {
                    traveler_name: string;
                    passport_number: string;
                    nationality?: string | null;
                    purpose?: string | null;
                    start_date?: string | null;
                    end_date?: string | null;
                    status?: string;
                    verification_code?: string | null;
                    content?: string | null;
                };
                Update: {
                    status?: string;
                    content?: string | null;
                };
            };
            medical_cases: {
                Row: {
                    id: string;
                    patient_id: string | null;
                    title: string;
                    description: string | null;
                    status: string;
                    priority: string | null;
                    assigned_to: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    patient_id?: string | null;
                    title: string;
                    description?: string | null;
                    status?: string;
                    priority?: string | null;
                    assigned_to?: string | null;
                };
                Update: {
                    title?: string;
                    description?: string | null;
                    status?: string;
                    priority?: string | null;
                    assigned_to?: string | null;
                };
            };
            case_notes: {
                Row: {
                    id: string;
                    case_id: string;
                    author_id: string | null;
                    content: string;
                    created_at: string;
                };
                Insert: {
                    case_id: string;
                    author_id?: string | null;
                    content: string;
                };
                Update: {
                    content?: string;
                };
            },
            consent_forms: {
                Row: {
                    id: string;
                    patient_id: string;
                    patient_name: string | null;
                    type: string;
                    status: string;
                    signed_at: string | null;
                    version: string | null;
                    created_at: string;
                };
                Insert: {
                    patient_id: string;
                    patient_name?: string | null;
                    type: string;
                    status?: string;
                    signed_at?: string | null;
                    version?: string | null;
                };
                Update: {
                    status?: string;
                    signed_at?: string | null;
                    version?: string | null;
                };
            },
            disputes: {
                Row: {
                    id: string;
                    reporter_name: string;
                    category: string;
                    priority: string;
                    status: string;
                    subject: string;
                    created_at: string;
                };
                Insert: {
                    reporter_name: string;
                    category: string;
                    priority?: string;
                    status?: string;
                    subject: string;
                };
                Update: {
                    category?: string;
                    priority?: string;
                    status?: string;
                    subject?: string;
                };
            };
        };
    };
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];