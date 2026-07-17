import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type FormData = z.infer<typeof schema>;

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
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

      <p className="text-sm text-text-muted text-center mt-6">
        Don't have an account?{' '}
        <Link to="/register" className="text-brass-400 hover:underline">Create one</Link>
      </p>
    </div>
  );
}
