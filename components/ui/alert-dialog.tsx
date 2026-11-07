import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './button';

interface AlertDialogProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children: React.ReactNode;
}

const AlertDialog: React.FC<AlertDialogProps> = ({ open, onOpenChange, children }) => {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
                onClick={() => onOpenChange?.(false)}
            />
            <div className="relative z-50 animate-scale-in">
                {children}
            </div>
        </div>
    );
};

const AlertDialogContent: React.FC<{ children: React.ReactNode; className?: string }> = ({
    children,
    className = '',
}) => (
    <div
        className={`
      bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full mx-4
      p-0 overflow-hidden ${className}
    `}
    >
        {children}
    </div>
);

const AlertDialogHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({
    children,
    className = '',
}) => (
    <div className={`flex flex-col space-y-2 p-6 pb-4 ${className}`}>{children}</div>
);

const AlertDialogTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({
    children,
    className = '',
}) => (
    <h2 className={`text-lg font-bold text-slate-900 ${className}`}>{children}</h2>
);

const AlertDialogDescription: React.FC<{ children: React.ReactNode; className?: string }> = ({
    children,
    className = '',
}) => (
    <p className={`text-sm text-slate-500 ${className}`}>{children}</p>
);

const AlertDialogFooter: React.FC<{ children: React.ReactNode; className?: string }> = ({
    children,
    className = '',
}) => (
    <div
        className={`flex flex-col-reverse sm:flex-row sm:justify-end gap-2 p-6 pt-4 bg-slate-50 ${className}`}
    >
        {children}
    </div>
);

const AlertDialogAction: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({
    children,
    className = '',
    ...props
}) => (
    <Button variant="default" className={className} {...props}>
        {children}
    </Button>
);

const AlertDialogCancel: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({
    children,
    className = '',
    ...props
}) => (
    <Button variant="outline" className={className} {...props}>
        {children}
    </Button>
);

export {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogFooter,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogAction,
    AlertDialogCancel,
};

// Animation styles
const alertStyles = `
  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes scale-in {
    from { 
      opacity: 0;
      transform: scale(0.95);
    }
    to { 
      opacity: 1;
      transform: scale(1);
    }
  }
  .animate-fade-in {
    animation: fade-in 0.2s ease-out forwards;
  }
  .animate-scale-in {
    animation: scale-in 0.2s ease-out forwards;
  }
`;

if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = alertStyles;
    document.head.appendChild(styleSheet);
}
