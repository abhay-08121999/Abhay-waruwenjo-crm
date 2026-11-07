import React, { useState, useEffect, useRef } from 'react';
import { Shield, Loader2, Eye, EyeOff, Lock, Mail, Activity, Users, Building2, ChevronRight } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { loginSchema } from '../lib/validations';
import { useAuth } from '../lib/auth';

interface RoleSelectionLoginProps {
  onLoginSuccess: () => void;
  onBack: () => void;
}

// Animated canvas particle background
const ParticleCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    const particles: { x: number; y: number; vx: number; vy: number; r: number; alpha: number }[] = [];
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.5 + 0.1,
      });
    }

    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(20, 184, 166, ${0.12 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw particles
      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(20, 184, 166, ${p.alpha})`;
        ctx.fill();

        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;
      });

      raf = requestAnimationFrame(draw);
    };

    draw();

    const onResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ opacity: 0.7 }}
    />
  );
};

// Animated stat card for the left panel
const StatCard: React.FC<{ icon: React.ReactNode; value: string; label: string; delay: string }> = ({ icon, value, label, delay }) => (
  <div
    className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm"
    style={{ animation: `slideInLeft 0.6s ease-out ${delay} both` }}
  >
    <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400 flex-shrink-0">
      {icon}
    </div>
    <div>
      <p className="text-white font-bold text-lg leading-none">{value}</p>
      <p className="text-white/50 text-xs font-medium mt-0.5">{label}</p>
    </div>
  </div>
);

const RoleSelectionLogin: React.FC<RoleSelectionLoginProps> = ({ onLoginSuccess, onBack }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [isFocused, setIsFocused] = useState<'email' | 'password' | null>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [userRoles, setUserRoles] = useState<any[]>([]);
  const { refreshRole } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Fetch user roles for role selection
  const fetchUserRoles = async (userId: string) => {
    try {
      // Get roles from user_roles table
      const { data: userRolesData, error: userRolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (userRolesError) {
        console.error('Error fetching user roles:', userRolesError);
        return [];
      }

      // Get profile role as backup
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      // Combine roles, avoiding duplicates
      const roles = (userRolesData || []).map(item => item.role);
      if (profile?.role && !roles.includes(profile.role)) {
        roles.push(profile.role);
      }

      return roles;
    } catch (error) {
      console.error('Error in fetchUserRoles:', error);
      return [];
    }
  };

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const roles = await fetchUserRoles(session.user.id);
          setUserRoles(roles);

          if (roles.length === 1) {
            // Auto-select if only one role
            setSelectedRole(roles[0]);
            await handleRoleSelection(roles[0], session.user.id);
          } else if (roles.length > 1) {
            // Multiple roles - wait for user to select
            setCheckingSession(false);
          } else {
            // No roles assigned
            setError('Access denied. No role assigned. Contact your administrator.');
            setCheckingSession(false);
          }
        } else {
          setCheckingSession(false);
        }
      } catch (err) {
        console.error('Session check error:', err);
        setCheckingSession(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const roles = await fetchUserRoles(session.user.id);
        setUserRoles(roles);

        if (roles.length === 1) {
          // Auto-select if only one role
          setSelectedRole(roles[0]);
          await handleRoleSelection(roles[0], session.user.id);
        } else if (roles.length > 1) {
          // Multiple roles - wait for user to select
        } else {
          await supabase.auth.signOut();
          setError('Access denied. No role assigned. Contact your administrator.');
        }
      } else if (event === 'SIGNED_OUT') {
        setUserRoles([]);
        setSelectedRole(null);
        setCheckingSession(true);
        checkSession();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleRoleSelection = async (role: string, userId: string) => {
    try {
      // Store the selected role in localStorage for the auth context to pick up
      localStorage.setItem('selectedRole', role);
      localStorage.setItem('userId', userId);
      
      // Update the auth context
      await refreshRole();
      onLoginSuccess();
    } catch (error) {
      console.error('Error selecting role:', error);
      setError('Failed to select role. Please try again.');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validation = loginSchema.safeParse(loginData);
    if (!validation.success) {
      setError(validation.error?.errors[0].message || 'Invalid input');
      return;
    }

    setIsLoading(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: loginData.email,
        password: loginData.password,
      });

      if (signInError) throw signInError;

      if (data.user) {
        const roles = await fetchUserRoles(data.user.id);
        setUserRoles(roles);

        if (roleError || (!roles && !profile?.role)) {
          await supabase.auth.signOut();
          setError('Access denied. No role assigned. Contact your administrator.');
          setIsLoading(false);
          return;
        }

        if (roles.length === 1) {
          // Auto-select if only one role
          await handleRoleSelection(roles[0], data.user.id);
        } else if (roles.length > 1) {
          // Multiple roles - show selection
          setIsLoading(false);
        } else {
          await supabase.auth.signOut();
          setError('Access denied. No role assigned. Contact your administrator.');
          setIsLoading(false);
        }
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to login. Check your credentials.');
      setIsLoading(false);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrator';
      case 'patient_coordinator': return 'Patient Coordinator';
      case 'in_house_doctor': return 'In-House Doctor';
      case 'medical_manager': return 'Medical Manager';
      case 'bdm': return 'BDM';
      case 'cdm': return 'CDM';
      case 'waru_buddy': return 'Waru Buddy';
      case 'hospital_admin': return 'Hospital Admin';
      case 'agent': return 'Agent';
      case 'indian_doctor': return 'Indian Doctor';
      case 'international_doctor': return 'International Doctor';
      default: return role;
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Shield size={20} />;
      case 'doctor': case 'in_house_doctor': case 'indian_doctor': case 'international_doctor': return <Users size={20} />;
      case 'patient_coordinator': return <Building2 size={20} />;
      case 'bdm': return <Activity size={20} />;
      case 'cdm': return <Users size={20} />;
      case 'waru_buddy': return <Shield size={20} />;
      case 'hospital_admin': return <Building2 size={20} />;
      case 'agent': return <Users size={20} />;
      default: return <Shield size={20} />;
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#030712]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-2 border-teal-500/20 animate-ping" />
            <div className="w-16 h-16 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center">
              <Activity className="w-7 h-7 text-teal-400 animate-pulse" />
            </div>
          </div>
          <p className="text-white/60 text-sm font-medium tracking-wide">Verifying session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030712] flex overflow-hidden relative">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Figtree:wght@300;400;500;600;700;800&display=swap');

        * { font-family: 'Figtree', system-ui, sans-serif; }

        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        @keyframes rotate-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .error-shake { animation: shake 0.4s ease-in-out; }
        .float-anim { animation: float 4s ease-in-out infinite; }
        .rotate-slow { animation: rotate-slow 20s linear infinite; }

        .input-glow:focus-within {
          box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.15), 0 0 24px rgba(20, 184, 166, 0.08);
        }

        .login-btn {
          background: linear-gradient(135deg, #0d9488 0%, #0891b2 50%, #0e7490 100%);
          background-size: 200% 200%;
          transition: all 0.3s ease;
        }
        .login-btn:hover:not(:disabled) {
          background-position: right center;
          box-shadow: 0 0 32px rgba(20, 184, 166, 0.35), 0 4px 20px rgba(8, 145, 178, 0.3);
          transform: translateY(-1px);
        }
        .login-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .login-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .card-glass {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
        }

        .trust-badge {
          background: rgba(20, 184, 166, 0.08);
          border: 1px solid rgba(20, 184, 166, 0.2);
        }

        .left-panel-bg {
          background: radial-gradient(ellipse at 30% 50%, rgba(20, 184, 166, 0.12) 0%, transparent 60%),
                      radial-gradient(ellipse at 80% 20%, rgba(8, 145, 178, 0.08) 0%, transparent 50%),
                      linear-gradient(160deg, #0a1628 0%, #030712 60%, #061020 100%);
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Left Panel — Brand & Stats */}
      <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] left-panel-bg relative flex-col justify-between p-12 xl:p-16 overflow-hidden">
        <ParticleCanvas />

        {/* Decorative rings */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none">
          <div className="w-[500px] h-[500px] rounded-full border border-teal-500/5 rotate-slow opacity-60" />
          <div className="absolute inset-[60px] rounded-full border border-teal-500/8" />
          <div className="absolute inset-[120px] rounded-full border border-teal-400/6" />
        </div>

        {/* Glow orb */}
        <div className="absolute top-1/3 left-1/3 w-72 h-72 bg-teal-500/10 rounded-full blur-[80px] pointer-events-none" />

        {/* Top: Logo */}
        <div style={{ animation: 'slideInLeft 0.5s ease-out 0.1s both' }}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center">
              <img src="/logo.png" alt="WaruWenJo" className="w-10 h-10 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
            <div>
              <p className="text-white font-bold text-lg leading-none tracking-tight">WaruWenJo</p>
              <p className="text-teal-400 text-xs font-semibold mt-0.5 tracking-wider uppercase">Admin Portal</p>
            </div>
          </div>
        </div>

        {/* Center: Headline */}
        <div className="relative z-10" style={{ animation: 'slideInLeft 0.6s ease-out 0.2s both' }}>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-bold uppercase tracking-widest mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
            Medical Field Force CRM
          </div>

          <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-tight mb-4 tracking-tight">
            Manage Your<br />
            <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(90deg, #2dd4bf, #38bdf8)' }}>
              Medical Network
            </span>
          </h1>

          <p className="text-white/50 text-base font-medium leading-relaxed max-w-sm">
            Streamline patient journeys, hospital partnerships, and specialist operations from one secure admin hub.
          </p>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 mt-10">
            <StatCard icon={<Users size={18} />} value="2,400+" label="Patient Leads" delay="0.3s" />
            <StatCard icon={<Building2 size={18} />} value="120+" label="Partner Hospitals" delay="0.4s" />
            <StatCard icon={<Activity size={18} />} value="98.9%" label="Uptime SLA" delay="0.5s" />
            <StatCard icon={<Shield size={18} />} value="HIPAA" label="Compliant & Secure" delay="0.6s" />
          </div>
        </div>

        {/* Bottom: Trust badges */}
        <div className="flex flex-wrap items-center gap-3" style={{ animation: 'slideInLeft 0.6s ease-out 0.7s both' }}>
          {['HIPAA Certified', 'ISO 27001', 'SOC 2 Type II', 'GDPR Ready'].map(badge => (
            <span key={badge} className="trust-badge text-teal-300 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full">
              {badge}
            </span>
          ))}
        </div>
      </div>

      {/* Right Panel — Login & Role Selection */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 relative"
        style={{ background: 'radial-gradient(ellipse at 60% 50%, rgba(20,184,166,0.05) 0%, transparent 60%), #030712' }}>

        {/* Mobile: top logo */}
        <div className="absolute top-6 left-6 lg:hidden flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center">
            <img src="/logo.png" alt="WaruWenJo" className="w-7 h-7 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
          <span className="text-white font-bold text-sm">WaruWenJo</span>
        </div>

        <div className="w-full max-w-[420px]" style={{ animation: 'slideInRight 0.6s ease-out 0.2s both' }}>
          {/* Header */}
          <div className="mb-8" style={{ animation: 'fadeInUp 0.5s ease-out 0.3s both' }}>
            <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mb-5 float-anim">
              <Users className="w-7 h-7 text-teal-400" />
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              {selectedRole ? 'Select Your Role' : 'Secure CRM Access'}
            </h2>
            <p className="text-white/40 text-sm font-medium mt-1.5">
              {selectedRole 
                ? 'Choose which role to access for this session' 
                : 'Sign in with your CRM credentials'}
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-5 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 error-shake">
              <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-red-400 block" />
              </div>
              <p className="text-red-400 text-sm font-medium leading-snug">{error}</p>
            </div>
          )}

          {/* Login Form */}
          {!selectedRole && (
            <div className="card-glass rounded-3xl p-6 space-y-5">
              <form onSubmit={handleLogin} className="space-y-5">
                {/* Email Field */}
                <div>
                  <label htmlFor="adminEmail" className="block text-xs font-bold text-white/60 uppercase tracking-widest mb-2">
                    Admin Email
                  </label>
                  <div className={`input-glow relative flex items-center rounded-2xl border transition-all duration-200 ${
                    isFocused === 'email' ? 'border-teal-500/50 bg-teal-500/5' : 'border-white/10 bg-white/3'
                  }`}>
                    <Mail size={16} className={`absolute left-4 transition-colors duration-200 ${isFocused === 'email' ? 'text-teal-400' : 'text-white/30'}`} />
                    <input
                      id="adminEmail"
                      type="email"
                      placeholder="admin@waruwenjo.com"
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      onFocus={() => setIsFocused('email')}
                      onBlur={() => setIsFocused(null)}
                      required
                      autoComplete="email"
                      className="w-full bg-transparent pl-11 pr-4 py-3.5 text-white placeholder:text-white/25 text-sm font-medium outline-none rounded-2xl"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <label htmlFor="adminPassword" className="block text-xs font-bold text-white/60 uppercase tracking-widest mb-2">
                    Password
                  </label>
                  <div className={`input-glow relative flex items-center rounded-2xl border transition-all duration-200 ${
                    isFocused === 'password' ? 'border-teal-500/50 bg-teal-500/5' : 'border-white/10 bg-white/3'
                  }`}>
                    <Lock size={16} className={`absolute left-4 transition-colors duration-200 ${isFocused === 'password' ? 'text-teal-400' : 'text-white/30'}`} />
                    <input
                      id="adminPassword"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••••••"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      onFocus={() => setIsFocused('password')}
                      onBlur={() => setIsFocused(null)}
                      required
                      autoComplete="current-password"
                      className="w-full bg-transparent pl-11 pr-12 py-3.5 text-white placeholder:text-white/25 text-sm font-medium outline-none rounded-2xl"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 p-1.5 text-white/30 hover:text-white/80 transition-colors duration-200 cursor-pointer rounded-lg"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="login-btn w-full py-4 rounded-2xl text-white font-bold text-sm tracking-wide cursor-pointer flex items-center justify-center gap-2.5 mt-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ChevronRight size={16} />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* Role Selection */}
          {selectedRole === null && userRoles.length > 0 && (
            <div className="mt-6 card-glass rounded-3xl p-6 animate-in fade-in slide-up duration-500">
              <h3 className="text-lg font-bold text-white mb-4">Select Your Role</h3>
              <div className="space-y-3">
                {userRoles.map((role) => (
                  <button
                    key={role}
                    onClick={() => handleRoleSelection(role, userRoles[0])}
                    className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-teal-500/10 hover:border-teal-500/30 transition-all duration-200 text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400 group-hover:bg-teal-500/30">
                        {getRoleIcon(role)}
                      </div>
                      <div>
                        <p className="text-white font-semibold text-sm">{getRoleLabel(role)}</p>
                        <p className="text-white/40 text-xs mt-0.5">Click to select this role</p>
                      </div>
                      <ChevronRight size={16} className="text-teal-400 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Security note */}
          <div className="mt-5 flex items-center gap-2 justify-center">
            <Shield size={12} className="text-teal-500/60" />
            <p className="text-white/30 text-xs font-medium text-center">
              All sessions are encrypted and access attempts are logged
            </p>
          </div>

          {/* Footer */}
          <p className="text-white/20 text-center text-xs font-medium mt-8">
            © {new Date().getYear() + 1} WaruWenJo Medical Tourism Platform
          </p>
        </div>
      </div>
    </div>
  );
};

export default RoleSelectionLogin;
