import React, { useState, useEffect, useRef } from 'react';

import {
  Shield,
  Loader2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Activity,
  Users,
  Building2,
  ChevronRight,
} from 'lucide-react';

import { supabase } from '../integrations/supabase/client';
import { loginSchema } from '../lib/validations';
import { getMyCrmAccess } from '../services/roles';

interface AdminLoginProps {
  onLoginSuccess: () => void;
  onBack: () => void;
}

/* -------------------------------------------------------------------------- */
/* Animated canvas particle background                                        */
/* -------------------------------------------------------------------------- */

const ParticleCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return;
    }

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const particles: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      alpha: number;
    }[] = [];

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

    let raf = 0;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      /* Draw connections */
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 120) {
            ctx.beginPath();

            ctx.strokeStyle = `rgba(255, 255, 255, ${
              0.28 * (1 - dist / 120)
            })`;

            ctx.lineWidth = 0.5;

            ctx.moveTo(
              particles[i].x,
              particles[i].y,
            );

            ctx.lineTo(
              particles[j].x,
              particles[j].y,
            );

            ctx.stroke();
          }
        }
      }

      /* Draw particles */
      particles.forEach((particle) => {
        ctx.beginPath();

        ctx.arc(
          particle.x,
          particle.y,
          particle.r,
          0,
          Math.PI * 2,
        );

        ctx.fillStyle = `rgba(255, 255, 255, ${particle.alpha + 0.15})`;

        ctx.fill();

        particle.x += particle.vx;
        particle.y += particle.vy;

        if (particle.x < 0 || particle.x > width) {
          particle.vx *= -1;
        }

        if (particle.y < 0 || particle.y > height) {
          particle.vy *= -1;
        }
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

/* -------------------------------------------------------------------------- */
/* Animated stat card                                                         */
/* -------------------------------------------------------------------------- */

const StatCard: React.FC<{
  icon: React.ReactNode;
  value: string;
  label: string;
  delay: string;
}> = ({ icon, value, label, delay }) => (
  <div
    className="stat-card flex items-center gap-3 rounded-2xl p-4"
    style={{
      animation: `slideInLeft 0.6s ease-out ${delay} both`,
    }}
  >
    <div className="w-11 h-11 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center text-white flex-shrink-0 shadow-inner">
      {icon}
    </div>

    <div>
      <p className="text-white font-extrabold text-xl leading-none">
        {value}
      </p>

      <p className="text-white/85 text-xs font-semibold mt-1">
        {label}
      </p>
    </div>
  </div>
);

/* -------------------------------------------------------------------------- */
/* Admin Login                                                                */
/* -------------------------------------------------------------------------- */

const AdminLogin: React.FC<AdminLoginProps> = ({
  onLoginSuccess,
  onBack,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const [showPassword, setShowPassword] =
    useState(false);

  const [loginData, setLoginData] = useState({
    email: '',
    password: '',
  });

  const [error, setError] =
    useState<string | null>(null);

  const [checkingSession, setCheckingSession] =
    useState(true);

  const [isFocused, setIsFocused] = useState<
    'email' | 'password' | null
  >(null);

  /* ------------------------------------------------------------------------ */
  /* Check existing session                                                   */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    let mounted = true;

    const checkExistingSession = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.error(
            'Supabase session check error:',
            sessionError,
          );

          return;
        }

        /*
         * There is no existing authenticated session.
         *
         * IMPORTANT:
         * Do not call refreshSession() here.
         * Do not call getMyCrmAccess() without a session.
         */
        if (!session?.user) {
          return;
        }

        try {
          const access = await getMyCrmAccess(
            session.user.id,
          );

          if (!mounted) {
            return;
          }

          const hasRole =
            Array.isArray(access.roles) &&
            access.roles.length > 0;

          const isActive =
            access.isActive !== false;

          if (hasRole && isActive) {
            console.log(
              'Existing CRM session is valid.',
            );

            onLoginSuccess();
          }
        } catch (accessError) {
          console.error(
            'Existing CRM access check failed:',
            accessError,
          );
        }
      } catch (err) {
        console.error(
          'Session initialization error:',
          err,
        );
      } finally {
        if (mounted) {
          setCheckingSession(false);
        }
      }
    };

    void checkExistingSession();

    /*
     * We intentionally do not perform CRM access checking from
     * onAuthStateChange.
     *
     * The login handler performs the access check after
     * signInWithPassword() has returned its authenticated session.
     */

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event) => {
        console.log(
          'Supabase auth event:',
          event,
        );
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [onLoginSuccess]);

  /* ------------------------------------------------------------------------ */
  /* Login                                                                     */
  /* ------------------------------------------------------------------------ */

  const handleLogin = async (
    e: React.FormEvent,
  ) => {
    e.preventDefault();

    if (isLoading) {
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      /* -------------------------------------------------------------------- */
      /* Validate form                                                        */
      /* -------------------------------------------------------------------- */

      const validation =
        loginSchema.safeParse(loginData);

      if (!validation.success) {
        const firstError =
          validation.error?.errors?.[0]?.message;

        setError(
          firstError ||
            'Invalid email or password.',
        );

        setIsLoading(false);
        return;
      }

      /* -------------------------------------------------------------------- */
      /* Supabase login                                                        */
      /* -------------------------------------------------------------------- */

      const {
        data: signInData,
        error: signInError,
      } = await supabase.auth.signInWithPassword({
        email: loginData.email.trim(),
        password: loginData.password,
      });

      if (signInError) {
        throw signInError;
      }

      /*
       * signInWithPassword() must return both the user
       * and an authenticated session.
       */

      if (
        !signInData?.user ||
        !signInData?.session
      ) {
        throw new Error(
          'Login succeeded, but Supabase did not return an authenticated session. Please try again.',
        );
      }

      const userId = signInData.user.id;

      console.log(
        'Supabase authentication successful:',
        userId,
      );

      console.log(
        'Supabase session received:',
        Boolean(signInData.session),
      );

      /* -------------------------------------------------------------------- */
      /* CRM access                                                           */
      /* -------------------------------------------------------------------- */

      const access =
        await getMyCrmAccess(userId);

      console.log(
        'CRM access result:',
        access,
      );

      const hasRole =
        Array.isArray(access.roles) &&
        access.roles.length > 0;

      const isActive =
        access.isActive !== false;

      /* -------------------------------------------------------------------- */
      /* No CRM role                                                          */
      /* -------------------------------------------------------------------- */

      if (!hasRole) {
        await supabase.auth.signOut();

        setError(
          'This account has no active CRM role. Ask the Super Admin to assign a role.',
        );

        setIsLoading(false);
        return;
      }

      /* -------------------------------------------------------------------- */
      /* Inactive CRM account                                                 */
      /* -------------------------------------------------------------------- */

      if (!isActive) {
        await supabase.auth.signOut();

        setError(
          'This CRM account is inactive. Ask the Super Admin to activate your account.',
        );

        setIsLoading(false);
        return;
      }

      /* -------------------------------------------------------------------- */
      /* Successful CRM login                                                 */
      /* -------------------------------------------------------------------- */

      console.log(
        'CRM authentication successful.',
      );

      console.log(
        'CRM roles:',
        access.roles.map(
          (role) => role.key,
        ),
      );

      console.log(
        'CRM permissions:',
        access.permissions,
      );

      onLoginSuccess();
    } catch (err: unknown) {
      console.error(
        'Admin login error:',
        err,
      );

      let message =
        'Failed to login. Please check your credentials.';

      if (err instanceof Error) {
        message = err.message;
      } else if (
        typeof err === 'object' &&
        err !== null &&
        'message' in err
      ) {
        message = String(
          (err as { message?: unknown })
            .message || message,
        );
      }

      const normalizedMessage =
        message.toLowerCase();

      if (
        normalizedMessage.includes(
          'invalid login credentials',
        )
      ) {
        message =
          'Invalid email or password.';
      } else if (
        normalizedMessage.includes(
          'email not confirmed',
        )
      ) {
        message =
          'Your email address has not been confirmed. Please confirm your email before signing in.';
      } else if (
        normalizedMessage.includes(
          'auth session missing',
        )
      ) {
        message =
          'The login session could not be established. Please try signing in again.';
      }

      setError(message);
      setIsLoading(false);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Loading screen                                                            */
  /* ------------------------------------------------------------------------ */

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-teal-50">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-2 border-teal-400/40 animate-ping" />

            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 shadow-lg shadow-teal-500/30 flex items-center justify-center">
              <Activity className="w-7 h-7 text-white animate-pulse" />
            </div>
          </div>

          <p className="text-slate-500 text-sm font-semibold tracking-wide">
            Verifying session...
          </p>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Main UI                                                                   */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden relative">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Figtree:wght@300;400;500;600;700;800&display=swap');

        * { font-family: 'Figtree', system-ui, sans-serif; }

        @keyframes slideInLeft { from { opacity: 0; transform: translateX(-24px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes slideInRight { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 20%, 60% { transform: translateX(-6px); } 40%, 80% { transform: translateX(6px); } }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
        @keyframes rotate-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes gradient-flow { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }

        .error-shake { animation: shake 0.4s ease-in-out; }
        .float-anim { animation: float 4s ease-in-out infinite; }
        .rotate-slow { animation: rotate-slow 40s linear infinite; }

        /* Bright brand panel */
        .left-panel-bg {
          background:
            radial-gradient(ellipse at 15% 10%, rgba(255, 255, 255, 0.22) 0%, transparent 45%),
            radial-gradient(ellipse at 85% 90%, rgba(99, 102, 241, 0.45) 0%, transparent 55%),
            linear-gradient(135deg, #0d9488 0%, #0891b2 48%, #2563eb 100%);
          background-size: 140% 140%;
          animation: gradient-flow 18s ease infinite;
        }

        .login-rings {
          right: -180px;
          bottom: -180px;
          width: 620px;
          height: 620px;
          opacity: 0.7;
          -webkit-mask-image: radial-gradient(circle at center, #000 30%, transparent 72%);
          mask-image: radial-gradient(circle at center, #000 30%, transparent 72%);
        }

        .stat-card {
          background: linear-gradient(145deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.08));
          border: 1px solid rgba(255, 255, 255, 0.28);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 10px 30px rgba(7, 89, 133, 0.25);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
        }
        .stat-card:hover {
          transform: translateY(-4px);
          border-color: rgba(255, 255, 255, 0.55);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 18px 38px rgba(7, 89, 133, 0.35);
        }

        .trust-badge {
          background: rgba(255, 255, 255, 0.16);
          border: 1px solid rgba(255, 255, 255, 0.35);
          transition: background 0.2s ease, transform 0.2s ease;
        }
        .trust-badge:hover { background: rgba(255, 255, 255, 0.28); transform: translateY(-1px); }

        /* Light, clean sign-in card */
        .card-glass {
          position: relative;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          box-shadow: 0 30px 70px -20px rgba(8, 145, 178, 0.35), 0 8px 24px rgba(15, 23, 42, 0.06);
        }
        .card-glass::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 4px;
          border-radius: 24px 24px 0 0;
          background: linear-gradient(90deg, #14b8a6, #06b6d4, #6366f1);
        }

        .input-glow { transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease; }
        .input-glow:hover { border-color: #94a3b8; }
        .input-glow:focus-within {
          box-shadow: 0 0 0 4px rgba(20, 184, 166, 0.16);
        }

        .login-btn {
          position: relative;
          overflow: hidden;
          background: linear-gradient(135deg, #0d9488 0%, #0891b2 50%, #2563eb 100%);
          background-size: 200% 200%;
          box-shadow: 0 12px 28px rgba(8, 145, 178, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.25);
          transition: all 0.3s ease;
        }
        .login-btn::after {
          content: '';
          position: absolute;
          top: 0; left: -120%;
          width: 60%; height: 100%;
          background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.4), transparent);
          transform: skewX(-20deg);
          transition: left 0.7s ease;
        }
        .login-btn:hover:not(:disabled) {
          background-position: right center;
          box-shadow: 0 16px 36px rgba(8, 145, 178, 0.45);
          transform: translateY(-2px);
        }
        .login-btn:hover:not(:disabled)::after { left: 140%; }
        .login-btn:active:not(:disabled) { transform: translateY(0); }
        .login-btn:focus-visible { outline: none; box-shadow: 0 0 0 4px rgba(20, 184, 166, 0.4), 0 12px 28px rgba(8, 145, 178, 0.35); }
        .login-btn:disabled { opacity: 0.7; cursor: not-allowed; }

        @media (prefers-reduced-motion: reduce) {
          .float-anim, .rotate-slow, .left-panel-bg { animation: none; }
          .login-btn::after { display: none; }
        }
      `}</style>

      {/* ------------------------------------------------------------------ */}
      {/* Left Panel                                                         */}
      {/* ------------------------------------------------------------------ */}

      <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] left-panel-bg relative flex-col justify-between p-12 xl:p-16 overflow-hidden">
        <ParticleCanvas />

        {/* Decorative rings */}
        <div className="login-rings absolute pointer-events-none select-none">
          <div className="w-full h-full rounded-full border border-white/40 rotate-slow" />

          <div className="absolute inset-[70px] rounded-full border border-white/30" />

          <div className="absolute inset-[140px] rounded-full border border-white/20" />
        </div>

        {/* Glow orb */}
        <div className="absolute top-1/3 left-1/3 w-80 h-80 bg-white/25 rounded-full blur-[90px] pointer-events-none" />

        {/* Top: Logo */}
        <div
          style={{
            animation:
              'slideInLeft 0.5s ease-out 0.1s both',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl overflow-hidden bg-white border border-white/60 shadow-lg shadow-sky-900/20 flex items-center justify-center">
              <img
                src="/logo.png"
                alt="WaruWenJo"
                className="w-10 h-10 object-contain"
                onError={(e) => {
                  (
                    e.target as HTMLImageElement
                  ).style.display = 'none';
                }}
              />
            </div>

            <div>
              <p className="text-white font-extrabold text-lg leading-none tracking-tight">
                WaruWenJo
              </p>

              <p className="text-cyan-100 text-xs font-semibold mt-0.5 tracking-wider uppercase">
                Admin Portal
              </p>
            </div>
          </div>
        </div>

        {/* Center */}
        <div
          className="relative z-10"
          style={{
            animation:
              'slideInLeft 0.6s ease-out 0.2s both',
          }}
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/20 border border-white/40 text-white text-xs font-bold uppercase tracking-widest mb-6 backdrop-blur">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            Medical Field Force CRM
          </div>

          <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-tight mb-4 tracking-tight">
            Manage Your
            <br />

            <span
              className="text-transparent bg-clip-text"
              style={{
                backgroundImage:
                  'linear-gradient(90deg, #ffffff, #a5f3fc, #fef9c3)',
              }}
            >
              Medical Network
            </span>
          </h1>

          <p className="text-white/90 text-base font-medium leading-relaxed max-w-sm">
            Streamline patient journeys, hospital partnerships,
            and specialist operations from one secure admin hub.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 mt-10">
            <StatCard
              icon={<Users size={18} />}
              value="2,400+"
              label="Patient Leads"
              delay="0.3s"
            />

            <StatCard
              icon={<Building2 size={18} />}
              value="120+"
              label="Partner Hospitals"
              delay="0.4s"
            />

            <StatCard
              icon={<Activity size={18} />}
              value="98.9%"
              label="Uptime SLA"
              delay="0.5s"
            />

            <StatCard
              icon={<Shield size={18} />}
              value="HIPAA"
              label="Compliant & Secure"
              delay="0.6s"
            />
          </div>
        </div>

        {/* Bottom */}
        <div
          className="flex flex-wrap items-center gap-3"
          style={{
            animation:
              'slideInLeft 0.6s ease-out 0.7s both',
          }}
        >
          {[
            'HIPAA Certified',
            'ISO 27001',
            'SOC 2 Type II',
            'GDPR Ready',
          ].map((badge) => (
            <span
              key={badge}
              className="trust-badge text-white text-[10px] font-bold uppercase tracking-widest px-3.5 py-1.5 rounded-full"
            >
              {badge}
            </span>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Right Panel                                                        */}
      {/* ------------------------------------------------------------------ */}

      <div
        className="flex-1 flex items-center justify-center p-6 sm:p-10 relative"
        style={{
          background:
            'radial-gradient(ellipse at 70% 15%, rgba(20,184,166,0.14) 0%, transparent 55%), radial-gradient(ellipse at 20% 90%, rgba(99,102,241,0.10) 0%, transparent 55%), linear-gradient(180deg, #f8fafc 0%, #eef7f8 100%)',
        }}
      >
        {/* Mobile logo */}
        <div className="absolute top-6 left-6 lg:hidden flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl overflow-hidden bg-white border border-slate-200 shadow-sm flex items-center justify-center">
            <img
              src="/logo.png"
              alt="WaruWenJo"
              className="w-7 h-7 object-contain"
              onError={(e) => {
                (
                  e.target as HTMLImageElement
                ).style.display = 'none';
              }}
            />
          </div>

          <span className="text-slate-800 font-bold text-sm">
            WaruWenJo
          </span>
        </div>

        <div
          className="w-full max-w-[420px]"
          style={{
            animation:
              'slideInRight 0.6s ease-out 0.2s both',
          }}
        >
          {/* Header */}
          <div
            className="mb-8"
            style={{
              animation:
                'fadeInUp 0.5s ease-out 0.3s both',
            }}
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 shadow-lg shadow-teal-500/30 flex items-center justify-center mb-5 float-anim">
              <Lock className="w-7 h-7 text-white" />
            </div>

            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Secure CRM Access
            </h2>

            <p className="text-slate-500 text-sm font-medium mt-1.5">
              Sign in with your CRM credentials
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3 error-shake">
              <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-red-500 block" />
              </div>

              <p className="text-red-600 text-sm font-semibold leading-snug">
                {error}
              </p>
            </div>
          )}

          {/* Form Card */}
          <div className="card-glass rounded-3xl p-7 space-y-5">
            <form
              onSubmit={handleLogin}
              className="space-y-5"
            >
              {/* Email */}
              <div>
                <label
                  htmlFor="adminEmail"
                  className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-2"
                >
                  Email / Login ID
                </label>

                <div
                  className={`input-glow relative flex items-center rounded-2xl border transition-all duration-200 ${
                    isFocused === 'email'
                      ? 'border-teal-500 bg-teal-50/50'
                      : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <Mail
                    size={16}
                    className={`absolute left-4 transition-colors duration-200 ${
                      isFocused === 'email'
                        ? 'text-teal-600'
                        : 'text-slate-400'
                    }`}
                  />

                  <input
                    id="adminEmail"
                    type="email"
                    placeholder="admin@waruwenjo.com"
                    value={loginData.email}
                    onChange={(e) =>
                      setLoginData({
                        ...loginData,
                        email: e.target.value,
                      })
                    }
                    onFocus={() =>
                      setIsFocused('email')
                    }
                    onBlur={() =>
                      setIsFocused(null)
                    }
                    required
                    autoComplete="email"
                    className="w-full bg-transparent pl-11 pr-4 py-3.5 text-slate-900 placeholder:text-slate-400 text-sm font-semibold outline-none rounded-2xl"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="adminPassword"
                  className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-2"
                >
                  Password
                </label>

                <div
                  className={`input-glow relative flex items-center rounded-2xl border transition-all duration-200 ${
                    isFocused === 'password'
                      ? 'border-teal-500 bg-teal-50/50'
                      : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <Lock
                    size={16}
                    className={`absolute left-4 transition-colors duration-200 ${
                      isFocused === 'password'
                        ? 'text-teal-600'
                        : 'text-slate-400'
                    }`}
                  />

                  <input
                    id="adminPassword"
                    type={
                      showPassword
                        ? 'text'
                        : 'password'
                    }
                    placeholder="••••••••••••"
                    value={loginData.password}
                    onChange={(e) =>
                      setLoginData({
                        ...loginData,
                        password: e.target.value,
                      })
                    }
                    onFocus={() =>
                      setIsFocused('password')
                    }
                    onBlur={() =>
                      setIsFocused(null)
                    }
                    required
                    autoComplete="current-password"
                    className="w-full bg-transparent pl-11 pr-12 py-3.5 text-slate-900 placeholder:text-slate-400 text-sm font-semibold outline-none rounded-2xl"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        !showPassword,
                      )
                    }
                    className="absolute right-3.5 p-1.5 text-slate-400 hover:text-teal-600 transition-colors duration-200 cursor-pointer rounded-lg"
                    aria-label={
                      showPassword
                        ? 'Hide password'
                        : 'Show password'
                    }
                  >
                    {showPassword ? (
                      <EyeOff size={16} />
                    ) : (
                      <Eye size={16} />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="login-btn w-full py-4 rounded-2xl text-white font-bold text-sm tracking-wide cursor-pointer flex items-center justify-center gap-2.5 mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2
                      size={18}
                      className="animate-spin"
                    />

                    <span>
                      Authenticating...
                    </span>
                  </>
                ) : (
                  <>
                    <span>
                      Access CRM Dashboard
                    </span>

                    <ChevronRight size={16} />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Security note */}
          <div className="mt-5 flex items-center gap-2 justify-center">
            <Shield
              size={12}
              className="text-teal-600"
            />

            <p className="text-slate-500 text-xs font-medium text-center">
              All sessions are encrypted and access
              attempts are logged
            </p>
          </div>

          {/* Footer */}
          <p className="text-slate-400 text-center text-xs font-medium mt-8">
            © {new Date().getFullYear()} WaruWenJo Medical
            Tourism Platform
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;