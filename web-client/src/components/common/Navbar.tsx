import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, LogOut, User as UserIcon, RefreshCw } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useHealth } from '../../hooks/useHealth';
import { ROUTES } from '../../utils/constants';

export const Navbar: React.FC = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const { diagnostic, isChecking, checkNow } = useHealth({
    enablePolling: true,
    autoPollIntervalMs: 25000,
  });
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.LOGIN);
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-6 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <Link to={ROUTES.DASHBOARD} className="flex items-center gap-2.5 group">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 group-hover:bg-indigo-600/30 transition-colors">
            <Shield className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-white group-hover:text-indigo-300 transition-colors">
              ContextVault
            </span>
            <span className="hidden sm:inline-block ml-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-800 rounded">
              Web Client
            </span>
          </div>
        </Link>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Live Backend Health Pill */}
        <div className="flex items-center gap-2">
          <Link
            to={ROUTES.HEALTH}
            title={`Backend: ${diagnostic.targetUrl} | Latency: ${diagnostic.responseTimeMs}ms`}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all hover:scale-105 ${
              diagnostic.isOnline
                ? diagnostic.status === 'healthy'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                diagnostic.isOnline
                  ? diagnostic.status === 'healthy'
                    ? 'bg-emerald-400 animate-pulse'
                    : 'bg-amber-400 animate-pulse'
                  : 'bg-rose-500'
              }`}
            />
            <span className="hidden md:inline font-mono">
              {diagnostic.isOnline ? 'Docker API' : 'Docker Offline'}
            </span>
            <span className="text-[11px] opacity-80 font-mono">
              {diagnostic.isOnline ? `${diagnostic.responseTimeMs}ms` : 'ERR'}
            </span>
          </Link>

          <button
            type="button"
            onClick={() => checkNow()}
            disabled={isChecking}
            title="Refresh Health Status"
            aria-label="Refresh Health Status"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* User Profile & Actions */}
        {isAuthenticated && user && (
          <div className="flex items-center gap-3 pl-3 border-l border-slate-800">
            <div className="hidden lg:flex flex-col text-right">
              <span className="text-xs font-semibold text-slate-200 leading-tight">
                {user.username}
              </span>
              <span className="text-[11px] text-slate-400 leading-tight truncate max-w-[140px]">
                {user.email}
              </span>
            </div>

            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
              <UserIcon className="w-4 h-4 text-indigo-400" />
            </div>

            <button
              type="button"
              onClick={handleLogout}
              title="Sign Out"
              aria-label="Sign Out"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
