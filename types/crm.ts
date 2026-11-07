
export type CaseStatus =
    | 'lead'
    | 'contacted'
    | 'documents_collected'
    | 'medical_review'
    | 'plan_proposed'
    | 'visa'
    | 'travel'
    | 'treatment'
    | 'post_op'
    | 'closed';

export type CasePriority = 'low' | 'medium' | 'high';

export interface MedicalCase {
    id: string;
    patient_id: string;
    title: string;
    status: CaseStatus;
    priority: CasePriority;
    assigned_to?: string;
    notes?: string;
    created_at: string;
    updated_at: string;
    patient?: {
        full_name: string;
        email: string;
        phone?: string;
        country?: string;
    };
}

export interface CaseNote {
    id: string;
    case_id: string;
    author_id: string;
    content: string;
    is_internal: boolean;
    created_at: string;
    author?: {
        full_name: string;
    };
}

export interface Payment {
    id: string;
    user_id: string;
    amount: number;
    currency: string;
    status: 'pending' | 'completed' | 'failed' | 'refunded';
    type: 'consultation' | 'treatment_advance' | 'treatment_final';
    reference_id?: string;
    transaction_id?: string;
    created_at: string;
}
