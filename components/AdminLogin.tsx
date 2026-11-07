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

            ctx.strokeStyle = `rgba(20, 184, 166, ${
              0.12 * (1 - dist / 120)
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

        ctx.fillStyle = `rgba(20, 184, 166, ${particle.alpha})`;

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
    className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm"
    style={{
      animation: `slideInLeft 0.6s ease-out ${delay} both`,
    }}
  >
    <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400 flex-shrink-0">
      {icon}
    </div>

    <div>
      <p className="text-white font-bold text-lg leading-none">
        {value}
      </p>

      <p className="text-white/50 text-xs font-medium mt-0.5">
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
      <div className="min-h-screen flex items-center justify-center bg-[#030712]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-2 border-teal-500/20 animate-ping" />

            <div className="w-16 h-16 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center">
              <Activity className="w-7 h-7 text-teal-400 animate-pulse" />
            </div>
          </div>

          <p className="text-white/60 text-sm font-medium tracking-wide">
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
    <div className="min-h-screen bg-[#030712] flex overflow-hidden relative">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Figtree:wght@300;400;500;600;700;800&display=swap');

        * {
          font-family: 'Figtree', system-ui, sans-serif;
        }

        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-24px);
          }

          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(24px);
          }

          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes shake {
          0%,
          100% {
            transform: translateX(0);
          }

          20%,
          60% {
            transform: translateX(-6px);
          }

          40%,
          80% {
            transform: translateX(6px);
          }
        }

        @keyframes float {
          0%,
          100% {
            transform: translateY(0px);
          }

          50% {
            transform: translateY(-12px);
          }
        }

        @keyframes rotate-slow {
          from {
            transform: rotate(0deg);
          }

          to {
            transform: rotate(360deg);
          }
        }

        .error-shake {
          animation: shake 0.4s ease-in-out;
        }

        .float-anim {
          animation: float 4s ease-in-out infinite;
        }

        .rotate-slow {
          animation: rotate-slow 20s linear infinite;
        }

        .input-glow:focus-within {
          box-shadow:
            0 0 0 3px rgba(20, 184, 166, 0.15),
            0 0 24px rgba(20, 184, 166, 0.08);
        }

        .login-btn {
          background:
            linear-gradient(
              135deg,
              #0d9488 0%,
              #0891b2 50%,
              #0e7490 100%
            );

          background-size: 200% 200%;
          transition: all 0.3s ease;
        }

        .login-btn:hover:not(:disabled) {
          background-position: right center;

          box-shadow:
            0 0 32px rgba(20, 184, 166, 0.35),
            0 4px 20px rgba(8, 145, 178, 0.3);

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
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
        }

        .trust-badge {
          background: rgba(20, 184, 166, 0.08);
          border: 1px solid rgba(20, 184, 166, 0.2);
        }

        .left-panel-bg {
          background:
            radial-gradient(
              ellipse at 30% 50%,
              rgba(20, 184, 166, 0.12) 0%,
              transparent 60%
            ),
            radial-gradient(
              ellipse at 80% 20%,
              rgba(8, 145, 178, 0.08) 0%,
              transparent 50%
            ),
            linear-gradient(
              160deg,
              #0a1628 0%,
              #030712 60%,
              #061020 100%
            );
        }
      `}</style>

      {/* ------------------------------------------------------------------ */}
      {/* Left Panel                                                         */}
      {/* ------------------------------------------------------------------ */}

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
        <div
          style={{
            animation:
              'slideInLeft 0.5s ease-out 0.1s both',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center">
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
              <p className="text-white font-bold text-lg leading-none tracking-tight">
                WaruWenJo
              </p>

              <p className="text-teal-400 text-xs font-semibold mt-0.5 tracking-wider uppercase">
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
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-bold uppercase tracking-widest mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
            Medical Field Force CRM
          </div>

          <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-tight mb-4 tracking-tight">
            Manage Your
            <br />

            <span
              className="text-transparent bg-clip-text"
              style={{
                backgroundImage:
                  'linear-gradient(90deg, #2dd4bf, #38bdf8)',
              }}
            >
              Medical Network
            </span>
          </h1>

          <p className="text-white/50 text-base font-medium leading-relaxed max-w-sm">
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
              className="trust-badge text-teal-300 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full"
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
            'radial-gradient(ellipse at 60% 50%, rgba(20,184,166,0.05) 0%, transparent 60%), #030712',
        }}
      >
        {/* Mobile logo */}
        <div className="absolute top-6 left-6 lg:hidden flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center">
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

          <span className="text-white font-bold text-sm">
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
            <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mb-5 float-anim">
              <Lock className="w-7 h-7 text-teal-400" />
            </div>

            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              Secure CRM Access
            </h2>

            <p className="text-white/40 text-sm font-medium mt-1.5">
              Sign in with your CRM credentials
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 error-shake">
              <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-red-400 block" />
              </div>

              <p className="text-red-400 text-sm font-medium leading-snug">
                {error}
              </p>
            </div>
          )}

          {/* Form Card */}
          <div className="card-glass rounded-3xl p-6 space-y-5">
            <form
              onSubmit={handleLogin}
              className="space-y-5"
            >
              {/* Email */}
              <div>
                <label
                  htmlFor="adminEmail"
                  className="block text-xs font-bold text-white/60 uppercase tracking-widest mb-2"
                >
                  Email / Login ID
                </label>

                <div
                  className={`input-glow relative flex items-center rounded-2xl border transition-all duration-200 ${
                    isFocused === 'email'
                      ? 'border-teal-500/50 bg-teal-500/5'
                      : 'border-white/10 bg-white/3'
                  }`}
                >
                  <Mail
                    size={16}
                    className={`absolute left-4 transition-colors duration-200 ${
                      isFocused === 'email'
                        ? 'text-teal-400'
                        : 'text-white/30'
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
                    className="w-full bg-transparent pl-11 pr-4 py-3.5 text-white placeholder:text-white/25 text-sm font-medium outline-none rounded-2xl"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="adminPassword"
                  className="block text-xs font-bold text-white/60 uppercase tracking-widest mb-2"
                >
                  Password
                </label>

                <div
                  className={`input-glow relative flex items-center rounded-2xl border transition-all duration-200 ${
                    isFocused === 'password'
                      ? 'border-teal-500/50 bg-teal-500/5'
                      : 'border-white/10 bg-white/3'
                  }`}
                >
                  <Lock
                    size={16}
                    className={`absolute left-4 transition-colors duration-200 ${
                      isFocused === 'password'
                        ? 'text-teal-400'
                        : 'text-white/30'
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
                    className="w-full bg-transparent pl-11 pr-12 py-3.5 text-white placeholder:text-white/25 text-sm font-medium outline-none rounded-2xl"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        !showPassword,
                      )
                    }
                    className="absolute right-3.5 p-1.5 text-white/30 hover:text-white/80 transition-colors duration-200 cursor-pointer rounded-lg"
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
              className="text-teal-500/60"
            />

            <p className="text-white/30 text-xs font-medium text-center">
              All sessions are encrypted and access
              attempts are logged
            </p>
          </div>

          {/* Footer */}
          <p className="text-white/20 text-center text-xs font-medium mt-8">
            © {new Date().getFullYear()} WaruWenJo Medical
            Tourism Platform
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;