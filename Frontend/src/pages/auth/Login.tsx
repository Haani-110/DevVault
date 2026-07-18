import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type FormData = z.infer<typeof schema>;

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
    </svg>
  );
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(searchParams.get('oauthError'));
  const [apiStatus, setApiStatus] = useState<'checking' | 'ok' | 'unreachable'>('checking');

  useEffect(() => {
    fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ping@ping.com', password: 'ping' }),
    })
      .then(() => setApiStatus('ok'))
      .catch(() => setApiStatus('unreachable'));
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setFormError(null);
    setSubmitting(true);
    try {
      await login(data);
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : 'Could not sign in');
      setFormError(String(msg));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1.5">Sign in</h2>
      <p className="text-sm text-text-muted mb-6">
        Welcome back. Enter your details to access your vault.
      </p>

      {/* Backend status */}
      <div className={`text-xs px-3 py-2 rounded-lg mb-5 flex items-center gap-2 ${
        apiStatus === 'checking' ? 'bg-surface text-text-muted' :
        apiStatus === 'ok' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
        'bg-red-500/10 text-red-400 border border-red-500/20'
      }`}>
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
          apiStatus === 'checking' ? 'bg-text-muted animate-pulse' :
          apiStatus === 'ok' ? 'bg-green-400' : 'bg-red-400'
        }`} />
        {apiStatus === 'checking' && 'Checking server…'}
        {apiStatus === 'ok' && 'Server reachable'}
        {apiStatus === 'unreachable' && 'Cannot reach server. Backend may be down — try reloading.'}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" className="input" placeholder="you@company.com" {...register('email')} />
          {errors.email && <p className="text-xs text-danger mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="label !mb-0" htmlFor="password">Password</label>
            <Link to="/forgot-password" className="text-xs text-brass-400 hover:underline">
              Forgot password?
            </Link>
          </div>
          <input id="password" type="password" className="input" placeholder="••••••••" {...register('password')} />
          {errors.password && <p className="text-xs text-danger mt-1">{errors.password.message}</p>}
        </div>

        {/* Persistent inline error */}
        {formError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
            {formError}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || apiStatus === 'unreachable'}
          className="btn-primary w-full mt-2"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-3 mt-6">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-text-faint">or continue with</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* OAuth buttons */}
      <div className="flex gap-3 mt-4">
        <a
          href="/api/v1/auth/google"
          className="flex-1 btn-ghost flex items-center justify-center gap-2 text-sm py-2"
        >
          <GoogleIcon />
          Google
        </a>
        <a
          href="/api/v1/auth/github"
          className="flex-1 btn-ghost flex items-center justify-center gap-2 text-sm py-2"
        >
          <GitHubIcon />
          GitHub
        </a>
      </div>

      <p className="text-sm text-text-muted text-center mt-6">
        Don't have an account?{' '}
        <Link to="/register" className="text-brass-400 hover:underline">Create one</Link>
      </p>
    </div>
  );
}
