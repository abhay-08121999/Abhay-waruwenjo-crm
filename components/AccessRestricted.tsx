import React from 'react';
import { ShieldCheck } from 'lucide-react';

interface AccessRestrictedProps {
  title?: string;
  description?: string;
}

const AccessRestricted: React.FC<AccessRestrictedProps> = ({
  title = 'Access Restricted',
  description = 'You do not have permission to access the Clinical Assessment stage.',
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-in fade-in duration-500">
      <div className="p-5 bg-rose-50 text-rose-700 rounded-2xl mb-4 shadow-sm">
        <ShieldCheck size={48} className="animate-pulse" />
      </div>
      <h2 className="text-2xl font-black text-slate-800 tracking-tight">{title}</h2>
      <p className="text-slate-500 mt-2 max-w-sm">{description}</p>
    </div>
  );
};

export default AccessRestricted;
