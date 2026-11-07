/**
 * Form Validation Schemas
 * Using custom validation without external dependencies for lightweight validation
 */

export interface ValidationResult {
    success: boolean;
    error?: {
        errors: { message: string }[];
    };
}

// Simple validation helper for login form
export const loginSchema = {
    safeParse: (data: { email: string; password: string }): ValidationResult => {
        const errors: { message: string }[] = [];

        // Email validation
        if (!data.email) {
            errors.push({ message: 'Email is required' });
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
            errors.push({ message: 'Please enter a valid email address' });
        }

        // Password validation
        if (!data.password) {
            errors.push({ message: 'Password is required' });
        } else if (data.password.length < 6) {
            errors.push({ message: 'Password must be at least 6 characters' });
        }

        return {
            success: errors.length === 0,
            error: errors.length > 0 ? { errors } : undefined,
        };
    },
};

// Registration validation
export const registerSchema = {
    safeParse: (data: { email: string; password: string; fullName: string }): ValidationResult => {
        const errors: { message: string }[] = [];

        // Full name validation
        if (!data.fullName) {
            errors.push({ message: 'Full name is required' });
        } else if (data.fullName.length < 2) {
            errors.push({ message: 'Full name must be at least 2 characters' });
        }

        // Email validation
        if (!data.email) {
            errors.push({ message: 'Email is required' });
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
            errors.push({ message: 'Please enter a valid email address' });
        }

        // Password validation
        if (!data.password) {
            errors.push({ message: 'Password is required' });
        } else if (data.password.length < 8) {
            errors.push({ message: 'Password must be at least 8 characters' });
        }

        return {
            success: errors.length === 0,
            error: errors.length > 0 ? { errors } : undefined,
        };
    },
};

// Patient/Appointment form validation
export const appointmentSchema = {
    safeParse: (data: {
        fullName: string;
        email: string;
        phone: string;
        country: string;
        treatmentType: string;
        preferredDate: string;
    }): ValidationResult => {
        const errors: { message: string }[] = [];

        if (!data.fullName || data.fullName.length < 2) {
            errors.push({ message: 'Full name is required (minimum 2 characters)' });
        }

        if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
            errors.push({ message: 'Valid email is required' });
        }

        if (!data.phone || data.phone.length < 8) {
            errors.push({ message: 'Valid phone number is required' });
        }

        if (!data.country) {
            errors.push({ message: 'Country is required' });
        }

        if (!data.treatmentType) {
            errors.push({ message: 'Treatment type is required' });
        }

        if (!data.preferredDate) {
            errors.push({ message: 'Preferred date is required' });
        }

        return {
            success: errors.length === 0,
            error: errors.length > 0 ? { errors } : undefined,
        };
    },
};