import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
    size?: 'default' | 'sm' | 'lg' | 'icon';
    asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className = '', variant = 'default', size = 'default', children, disabled, ...props }, ref) => {
        const baseStyles = 'inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/20 disabled:pointer-events-none disabled:opacity-50';

        const variantStyles = {
            default: 'bg-gradient-to-r from-teal-600 to-teal-500 text-white hover:from-teal-700 hover:to-teal-600 shadow-lg shadow-teal-500/25 hover:shadow-xl hover:shadow-teal-500/30 hover:-translate-y-0.5',
            destructive: 'bg-gradient-to-r from-red-600 to-red-500 text-white hover:from-red-700 hover:to-red-600 shadow-lg shadow-red-500/25',
            outline: 'border-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-teal-500 hover:text-teal-600',
            secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200',
            ghost: 'hover:bg-slate-100 text-slate-700 hover:text-slate-900',
            link: 'text-teal-600 underline-offset-4 hover:underline hover:text-teal-700',
        };

        const sizeStyles = {
            default: 'h-11 px-6 py-2',
            sm: 'h-9 px-4 text-xs',
            lg: 'h-12 px-8 text-base',
            icon: 'h-10 w-10',
        };

        return (
            <button
                className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
                ref={ref}
                disabled={disabled}
                {...props}
            >
                {children}
            </button>
        );
    }
);

Button.displayName = 'Button';

export { Button };
