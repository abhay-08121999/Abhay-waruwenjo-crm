
import React from 'react';
import { NAVIGATION } from '../constants.tsx';
import { Menu, X, Activity, ShieldCheck } from 'lucide-react';
import { canAccessRoute, CrmRole } from '../services/roles';

interface SidebarProps {
  currentPath: string;
  roles: CrmRole[];
  permissions: Record<string, boolean>;
}

const Sidebar: React.FC<SidebarProps> = ({
  currentPath,
  roles,
  permissions,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);

  // Remove User Management from NAVIGATION to prevent duplicate links.
  // The dedicated User & Role Management link below is retained.
  const navigation = NAVIGATION.filter(
    item =>
      item.path !== '#/crm-users' &&
      item.name !== 'User Management' &&
      item.name !== 'User & Role Management' &&
      canAccessRoute(roles, permissions, item.path)
  );

  const showUserManagement =
    permissions['users.manage'] ||
    roles.some(role => role.key === 'super_admin');

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
          className="p-2 bg-white rounded-md shadow-md text-teal-600 focus:outline-none"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900 bg-opacity-50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out flex flex-col h-full ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 lg:static lg:inset-0 lg:h-full`}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-4 flex-shrink-0">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-lg shadow-teal-500/20 overflow-hidden">
            <img
              src="/logo.png"
              alt="WaruWenJo"
              className="w-full h-full object-contain p-1"
            />
          </div>

          <div>
            <h1 className="text-xl font-bold tracking-tight">
              WaruWenJo
            </h1>
            <p className="text-[10px] uppercase tracking-widest text-teal-400 font-bold">
              Medical CRM
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-6 pb-4 space-y-1 custom-scrollbar">
          {navigation.map(item => {
            const isActive =
              currentPath === item.path ||
              (currentPath === '' && item.path === '#/');

            return (
              <a
                key={item.name}
                href={item.path}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-teal-600 text-white shadow-md'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span
                  className={
                    isActive ? 'text-white' : 'text-slate-500'
                  }
                >
                  {item.icon}
                </span>
                {item.name}
              </a>
            );
          })}

          {/* Original User & Role Management link */}
          {showUserManagement && (
            <a
              href="#/crm-users"
              onClick={() => setIsOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                currentPath === '#/crm-users'
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <ShieldCheck size={20} />
              <span>User &amp; Role Management</span>
            </a>
          )}
        </nav>

        {/* System status */}
        <div className="flex-shrink-0 p-6 border-t border-slate-800">
          <div className="flex items-center gap-3 text-slate-500">
            <Activity size={18} />
            <p className="text-[10px] font-black uppercase tracking-widest">
              System Online
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
