import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar.tsx';
import Dashboard from './components/Dashboard.tsx';
import Leads from './components/Leads.tsx';
import Pipeline from './components/Pipeline.tsx';
import PatientPipeline from './components/PatientPipeline.tsx';
import AIInsights from './components/AIInsights.tsx';
import Tasks from './components/Tasks.tsx';
import Reports from './components/Reports.tsx';
import Settings from './components/Settings.tsx';
import FieldRoutes from './components/FieldRoutes.tsx';
import Inventory from './components/Inventory.tsx';
import Expenses from './components/Expenses.tsx';
import LeadAutomation from './components/LeadAutomation.tsx';
import ClinicalBridge from './components/ClinicalBridge.tsx';
import InternationalTravel from './components/InternationalTravel.tsx';
import CommunicationHub from './components/CommunicationHub.tsx';
import LogisticsHub from './components/LogisticsHub.tsx';
import DigitalVault from './components/DigitalVault.tsx';
import TravelManagement from './components/TravelManagement.tsx';
import ConsentManagement from './components/ConsentManagement.tsx';
import DisputeManagement from './components/DisputeManagement.tsx';
import FinanceModule from './components/FinanceModule.tsx';
import AgreementModule from './components/AgreementModule.tsx';
import PatientLeads from './components/PatientLeads.tsx';
import PatientDocumentUpload from './components/PatientDocumentUpload.tsx';
import Hospitals from './components/Hospitals.tsx';
import Doctors from './components/Doctors.tsx';
import AdminLogin from './components/AdminLogin.tsx';
import Quotations from './components/quotations/Quotations.tsx';
import WhatsAppIntegration from './components/WhatsAppIntegration.tsx';
import CrmUserManagement from './components/admin/CrmUserManagement.tsx';
import { canAccessRoute, CrmRole, getMyCrmAccess } from './services/roles';
import { ShieldCheck, Search, Bell, LogOut, Shield } from 'lucide-react';
import { supabase } from './integrations/supabase/client';


const AccessDenied: React.FC = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
    <div className="p-5 bg-red-50 text-red-600 rounded-2xl mb-4">
      <ShieldCheck size={48} />
    </div>
    <h2 className="text-2xl font-black text-slate-800">Access Restricted</h2>
    <p className="text-slate-500 mt-2 max-w-md">Your CRM role does not have permission to access this module.</p>
    <a href="#/" className="mt-8 px-6 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 font-bold">Back to Dashboard</a>
  </div>
);

const App: React.FC = () => {
  const [currentHash, setCurrentHash] = useState(() => {
    const hash = window.location.hash;
    return (hash === '' || hash === '#') ? '#/' : hash;
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [adminUser, setAdminUser] = useState<any>(null);
  const [currentRole, setCurrentRole] = useState<CrmRole | null>(null);
  const [currentRoles, setCurrentRoles] = useState<CrmRole[]>([]);
  const [currentPermissions, setCurrentPermissions] = useState<Record<string, boolean>>({});

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const access = await getMyCrmAccess(session.user.id);
          if (access.primaryRole) {
            setIsAuthenticated(true);
            setAdminUser(session.user);
            setCurrentRoles(access.roles);
            setCurrentRole(access.primaryRole);
            setCurrentPermissions(access.permissions);
          } else {
            await supabase.auth.signOut();
          }
        }
      } catch (error) {
        console.error('Auth check error:', error);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'TOKEN_REFRESHED') {
        console.log('Supabase token refreshed');
      }
      if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
        setAdminUser(null);
        setCurrentRole(null);
        setCurrentRoles([]);
        setCurrentPermissions({});
        // Redirect to login on signout
        if (window.location.hash !== '#/login') {
          window.location.hash = '#/login';
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const normalized = (hash === '' || hash === '#') ? '#/' : hash;
      setCurrentHash(normalized);
    };

    window.addEventListener('hashchange', handleHashChange);
    if (!window.location.hash) {
      window.location.hash = '#/';
    }
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // When the tab comes back to the foreground, make sure the token is fresh.
  // Browsers throttle timers in background tabs, so the auto-refresh can be missed.
  useEffect(() => {
    if (!isAuthenticated) return;
    const onVisible = async () => {
      if (document.visibilityState !== 'visible') return;
      const { data: { session } } = await supabase.auth.getSession();
      const expiresAtMs = (session?.expires_at ?? 0) * 1000;
      if (session && expiresAtMs - Date.now() < 5 * 60 * 1000) {
        await supabase.auth.refreshSession();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [isAuthenticated]);

  // Auto-logout after 10 minutes of inactivity
  useEffect(() => {
    if (!isAuthenticated) return;

    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        console.log('Session expired due to inactivity');
        handleLogout();
      }, 10 * 60 * 1000); // 10 minutes
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => document.addEventListener(event, resetTimer));

    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(event => document.removeEventListener(event, resetTimer));
    };
  }, [isAuthenticated]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setAdminUser(null);
    setCurrentRole(null);
        setCurrentRoles([]);
        setCurrentPermissions({});
    window.location.hash = '#/login';
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const access = await getMyCrmAccess(user.id);
      if (!access.primaryRole) {
        await supabase.auth.signOut();
        setIsAuthenticated(false);
        setAdminUser(null);
        setCurrentRoles([]);
        setCurrentRole(null);
        setCurrentPermissions({});
        window.location.hash = '#/login';
        return;
      }
      setAdminUser(user);
      setCurrentRoles(access.roles);
      setCurrentRole(access.primaryRole);
      setCurrentPermissions(access.permissions);
      window.location.hash = '#/';
    })();
  };

  const handleBackToLogin = () => {
    window.location.hash = '#/';
  };

  // Show loading while checking auth
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-teal-900 to-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-24 h-24 mb-4 flex items-center justify-center animate-pulse">
            <img src="/logo.png" alt="Loading..." className="w-full h-full object-contain" />
          </div>
          <p className="text-white/80 font-medium">Loading WaruWenJo Admin...</p>
        </div>
      </div>
    );
  }

  const patientDocumentMatch = currentHash.match(/^#\/patient-documents\/([^/?]+)/);
  if (patientDocumentMatch) {
    return <PatientDocumentUpload leadId={decodeURIComponent(patientDocumentMatch[1])} />;
  }

  // Show login page if not authenticated or on login route
  if (currentHash === '#/login' || !isAuthenticated) {
    return (
      <AdminLogin
        onLoginSuccess={handleLoginSuccess}
        onBack={handleBackToLogin}
      />
    );
  }

  const renderView = () => {
    if (currentHash === '#/crm-users') {
      if (!currentRoles.some(role => role.key === 'super_admin')) {
        return <AccessDenied />;
      }
      return <CrmUserManagement />;
    }

    if (!canAccessRoute(currentRoles, currentPermissions, currentHash)) {
      return <AccessDenied />;
    }

    switch (currentHash) {
      case '#/':
        return <Dashboard />;
      case '#/hospitals':
        return <Hospitals />;
      case '#/doctors':
        return <Doctors />;
      case '#/patient-leads':
        return <PatientLeads />;
      case '#/automation':
        return <LeadAutomation />;
      case '#/bridge':
        return <ClinicalBridge />;
      case '#/communications':
        return <CommunicationHub />;
      case '#/whatsapp':
        return <WhatsAppIntegration />;
      case '#/vault':
        return <DigitalVault />;
      case '#/travel-mgmt':
        return <TravelManagement />;
      case '#/consent':
        return <ConsentManagement />;
      case '#/disputes':
        return <DisputeManagement />;
      case '#/finance':
        return <FinanceModule />;
      case '#/agreements':
        return <AgreementModule />;
      case '#/quotations':
        return <Quotations />;
      case '#/travel':
        return <InternationalTravel />;
      case '#/logistics':
        return <LogisticsHub />;
      case '#/routes':
        return <FieldRoutes />;
      case '#/leads':
        return <Leads />;
      case '#/pipeline':
        return <Pipeline />;
      case '#/patients':
        return <PatientPipeline />;
      case '#/inventory':
        return <Inventory />;
      case '#/expenses':
        return <Expenses />;
      case '#/insights':
        return <AIInsights />;
      case '#/tasks':
        return <Tasks />;
      case '#/reports':
        return <Reports />;
      case '#/settings':
        return <Settings />;
      default:
        return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-in fade-in duration-500">
            <div className="p-5 bg-teal-50 text-teal-700 rounded-2xl mb-4 shadow-sm">
              <ShieldCheck size={48} className="animate-pulse" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Access Restricted</h2>
            <p className="text-slate-500 mt-2 max-w-sm">The module you're trying to reach is either restricted for your role or under system synchronization.</p>
            <a href="#/" className="mt-8 px-8 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 font-black shadow-xl shadow-teal-500/20 transition-all hover:-translate-y-1">
              Back to Operations
            </a>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900 selection:bg-teal-100 selection:text-teal-900">
      <Sidebar currentPath={currentHash} roles={currentRoles} permissions={currentPermissions} />

      {/* Content column — header pinned, only scroll area scrolls */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header — OUTSIDE scroll container, always visible */}
        <header className="flex-shrink-0 z-30 flex items-center justify-between px-8 py-4 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
          <div className="hidden md:flex items-center gap-2 relative max-w-lg w-full">
            <Search size={18} className="absolute left-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search patients, medical IDs, or staff..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-100/50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all outline-none font-medium"
            />
          </div>

          <div className="flex items-center gap-5">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg border border-green-100">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-ping"></span>
              <span className="text-[10px] font-black uppercase tracking-widest">Active HIPAA Session</span>
            </div>

            <button className="relative p-2.5 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-xl transition-all">
              <Bell size={20} />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 border-2 border-white rounded-full"></span>
            </button>

            <div className="h-8 w-px bg-slate-200"></div>

            <div className="flex items-center gap-3 group cursor-pointer">
              <div className="text-right hidden lg:block">
                <p className="text-sm font-black text-slate-800 leading-tight group-hover:text-teal-600 transition-colors">
                  {adminUser?.user_metadata?.full_name || adminUser?.email?.split('@')[0] || 'Admin User'}
                </p>
                <div className="flex items-center justify-end gap-1">
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-tight">{currentRole?.name || 'CRM User'}</span>
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center ring-2 ring-white shadow-lg overflow-hidden">
                {adminUser?.user_metadata?.avatar_url ? (
                  <img src={adminUser.user_metadata.avatar_url} className="w-full h-full object-cover" alt="Avatar" />
                ) : (
                  <Shield className="w-5 h-5 text-white" />
                )}
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-2.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        {/* Scroll area — ONLY this region scrolls, no transform wrapper */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth">
          <div className="p-8 max-w-[1600px] mx-auto">
            {renderView()}
          </div>
        </div>

      </div>
    </div>
  );
};

export default App;