import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Shield, ArrowRight, Lock, User as UserIcon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { ROUTES, API_CONFIG } from '../utils/constants';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { errorService } from '../services/errorService';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(() => {
    const params = new URLSearchParams(location.search);
    return params.get('sessionExpired') ? 'Your session has expired. Please sign in again.' : null;
  });
  const [errorDetails, setErrorDetails] = useState<string[]>([]);
  const [isNetworkError, setIsNetworkError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrUsername.trim() || !password) {
      setErrorMessage('Please enter both your email/username and password.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setErrorDetails([]);
    setIsNetworkError(false);

    try {
      await login({
        emailOrUsername: emailOrUsername.trim(),
        password,
      });

      const destination =
        (location.state as { from?: { pathname?: string } })?.from?.pathname || ROUTES.DASHBOARD;
      navigate(destination, { replace: true });
    } catch (err) {
      const parsed = errorService.parse(err);
      setErrorMessage(parsed.message);
      setErrorDetails(parsed.errors);
      setIsNetworkError(Boolean(parsed.isNetworkError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-slate-100">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 mb-4 shadow-lg shadow-indigo-600/10">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">ContextVault API Client</h1>
          <p className="mt-2 text-sm text-slate-400">
            Sign in to access your screenshot intelligence vault
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-slate-900 border border-slate-800 text-slate-400">
            <span>Target:</span>
            <span className="text-indigo-400">{API_CONFIG.BASE_URL}</span>
          </div>
        </div>

        {/* Form Container */}
        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-8 shadow-xl shadow-slate-950/50">
          {errorMessage && (
            <ErrorAlert
              message={errorMessage}
              errors={errorDetails}
              isNetworkError={isNetworkError}
              onDismiss={() => setErrorMessage(null)}
            />
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="emailOrUsername"
                className="block text-xs font-medium uppercase tracking-wider text-slate-300 mb-2"
              >
                Email or Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  id="emailOrUsername"
                  type="text"
                  required
                  disabled={isSubmitting}
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  placeholder="e.g. kirtan or user@example.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium uppercase tracking-wider text-slate-300 mb-2"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  disabled={isSubmitting}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your account password"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50"
            >
              {isSubmitting ? (
                <LoadingSpinner size="sm" text="Authenticating..." />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer switch */}
          <div className="mt-6 pt-6 border-t border-slate-800 text-center text-xs text-slate-400">
            Don't have an account?{' '}
            <Link
              to={ROUTES.REGISTER}
              className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Create Account
            </Link>
          </div>
        </div>

        {/* Health status quick link */}
        <div className="mt-6 text-center text-xs text-slate-500">
          Need to test backend connectivity?{' '}
          <Link to={ROUTES.HEALTH} className="text-slate-400 hover:text-white underline">
            Open Health & Diagnostics
          </Link>
        </div>
      </div>
    </div>
  );
};
