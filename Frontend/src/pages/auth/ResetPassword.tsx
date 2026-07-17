import { useState, type FormEvent, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { FiLock, FiEye, FiEyeOff, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import { api } from '@/lib/axios';
import toast from 'react-hot-toast';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) setError('No reset token found. Please request a new reset link.');
  }, [token]);

  const strength = (() => {
    if (password.length === 0) return 0;
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();

  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength];
  const strengthColor = ['', 'bg-red-400', 'bg-brass-400', 'bg-yellow-400', 'bg-green-400'][strength];

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) { toast.error('Passwords do not match'); return; }
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return; }

    setLoading(true);
    setError('');
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      setDone(true);
      toast.success('Password updated!');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to reset password. The link may have expired.';
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="text-center">
        <div className="w-14 h-14 rounded-full bg-green-400/10 border border-green-400/30 flex items-center justify-center mx-auto mb-5">
          <FiCheckCircle size={24} className="text-green-400" />
        </div>
        <h2 className="font-display text-2xl font-semibold mb-2">Password updated!</h2>
        <p className="text-sm text-text-muted mb-8">
          Your password has been changed. Redirecting you to sign in…
        </p>
        <Link to="/login" className="btn-primary w-full">Sign in now</Link>
      </div>
    );
  }

  if (error && !token) {
    return (
      <div className="text-center">
        <div className="w-14 h-14 rounded-full bg-red-400/10 border border-red-400/30 flex items-center justify-center mx-auto mb-5">
          <FiAlertCircle size={24} className="text-red-400" />
        </div>
        <h2 className="font-display text-2xl font-semibold mb-2">Invalid link</h2>
        <p className="text-sm text-text-muted mb-8">{error}</p>
        <Link to="/forgot-password" className="btn-primary w-full">Request a new link</Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1.5">Choose a new password</h2>
      <p className="text-sm text-text-muted mb-8 leading-relaxed">
        Must be at least 8 characters. A mix of letters, numbers and symbols makes it stronger.
      </p>

      {error && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-400/30 bg-red-400/5 px-4 py-3">
          <FiAlertCircle size={15} className="text-red-400 mt-0.5 shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="password">New password</label>
          <div className="relative">
            <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" size={15} />
            <input
              id="password"
              type={show ? 'text' : 'password'}
              className="input pl-9 pr-10"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-faint hover:text-text"
              tabIndex={-1}
            >
              {show ? <FiEyeOff size={15} /> : <FiEye size={15} />}
            </button>
          </div>

          {/* Strength bar */}
          {password.length > 0 && (
            <div className="mt-2 space-y-1">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-all ${
                      i <= strength ? strengthColor : 'bg-surface-hover'
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-text-faint">{strengthLabel}</p>
            </div>
          )}
        </div>

        <div>
          <label className="label" htmlFor="confirm">Confirm password</label>
          <div className="relative">
            <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" size={15} />
            <input
              id="confirm"
              type={show ? 'text' : 'password'}
              className="input pl-9"
              placeholder="Repeat your new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
          {confirm && confirm !== password && (
            <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
          )}
        </div>

        <button
          type="submit"
          className="btn-primary w-full"
          disabled={loading || !password || password !== confirm}
        >
          {loading ? 'Updating…' : 'Set new password'}
        </button>
      </form>
    </div>
  );
}
