import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import toast from 'react-hot-toast';
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

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setSubmitting(true);
    try {
      await login(data);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not sign in');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1.5">Sign in</h2>
      <p className="text-sm text-text-muted mb-8">
        Welcome back. Enter your details to access your vault.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="input"
            placeholder="you@company.com"
            {...register('email')}
          />
          {errors.email && <p className="text-xs text-danger mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="label !mb-0" htmlFor="password">
              Password
            </label>
            <Link to="/forgot-password" className="text-xs text-brass-400 hover:underline">
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            className="input"
            placeholder="••••••••"
            {...register('password')}
          />
          {errors.password && <p className="text-xs text-danger mt-1">{errors.password.message}</p>}
        </div>

        <button type="submit" disabled={submitting} className="btn-primary w-full mt-2">
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="text-sm text-text-muted text-center mt-6">
        Don't have an account?{' '}
        <Link to="/register" className="text-brass-400 hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
