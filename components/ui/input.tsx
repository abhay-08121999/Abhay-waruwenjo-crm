import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className = '', type = 'text', error, ...props }, ref) => {
        const baseStyles = `
      flex h-11 w-full rounded-xl border bg-white px-4 py-2 text-sm font-medium
      transition-all duration-200 ease-in-out
      placeholder:text-slate-400
      focus:outline-none focus:ring-4 focus:ring-teal-500/20 focus:border-teal-500
      disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-50
    `;

        const normalStyles = 'border-slate-200 hover:border-slate-300';
        const errorStyles = 'border-red-500 focus:border-red-500 focus:ring-red-500/20';

        return (
            <input
                type={type}
                className={`${baseStyles} ${error ? errorStyles : normalStyles} ${className}`}
                ref={ref}
                {...props}
            />
        );
    }
);

Input.displayName = 'Input';

export { Input };
