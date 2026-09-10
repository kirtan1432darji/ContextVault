import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Image as ImageIcon,
  Activity,
  FileCode,
  ExternalLink,
  ShieldCheck,
  HelpCircle,
} from 'lucide-react';
import { ROUTES, API_CONFIG } from '../../utils/constants';

export const Sidebar: React.FC = () => {
  const navItems = [
    {
      to: ROUTES.DASHBOARD,
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      to: ROUTES.SCREENSHOTS,
      label: 'Screenshots',
      icon: ImageIcon,
    },
    {
      to: ROUTES.HEALTH,
      label: 'Health & Diagnostics',
      icon: Activity,
    },
  ];

  return (
    <aside className="w-64 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col justify-between hidden md:flex">
      {/* Navigation Links */}
      <div className="p-4 space-y-1">
        <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}

        {/* Backend API Documentation Links */}
        <div className="pt-6 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          API Explorer
        </div>
        <a
          href={`${API_CONFIG.BASE_URL}/docs`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
        >
          <div className="flex items-center gap-3">
            <FileCode className="w-4 h-4 text-emerald-400" />
            <span>Swagger Docs</span>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
        </a>

        <a
          href={`${API_CONFIG.BASE_URL}/redoc`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
        >
          <div className="flex items-center gap-3">
            <HelpCircle className="w-4 h-4 text-sky-400" />
            <span>ReDoc Specs</span>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
        </a>
      </div>

      {/* Footer Info Box */}
      <div className="p-4 m-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs">
        <div className="flex items-center gap-2 text-indigo-400 font-semibold mb-1">
          <ShieldCheck className="w-4 h-4" />
          <span>Zero Binary Guarantee</span>
        </div>
        <p className="text-slate-400 text-[11px] leading-relaxed">
          Original image binaries remain protected on device. Only OCR text tokens and metadata are synchronized.
        </p>
        <div className="mt-2 pt-2 border-t border-slate-800 text-[10px] text-slate-500 font-mono truncate">
          Target: {API_CONFIG.BASE_URL}
        </div>
      </div>
    </aside>
  );
};
