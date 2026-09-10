import React, { useState } from 'react';
import {
  Activity,
  Server,
  Database,
  Clock,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Cpu,
  Layers,
} from 'lucide-react';
import { useHealth } from '../hooks/useHealth';
import { StatusBadge } from '../components/common/StatusBadge';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { API_CONFIG } from '../utils/constants';
import { getLatencyStatus } from '../utils/formatters';

export const HealthCheckPage: React.FC = () => {
  const { diagnostic, isChecking, checkNow } = useHealth();
  const [pingHistory, setPingHistory] = useState<
    Array<{ timestamp: string; latency: number; status: string }>
  >([]);

  const handleManualPing = async () => {
    const result = await checkNow();
    setPingHistory((prev) => [
      {
        timestamp: new Date().toLocaleTimeString(),
        latency: result.responseTimeMs,
        status: result.status,
      },
      ...prev.slice(0, 7),
    ]);
  };

  const latencyBadge = getLatencyStatus(diagnostic.responseTimeMs);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <Activity className="w-7 h-7 text-indigo-400" />
            <span>Health & Diagnostics</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Real-time status, response benchmarks, and connectivity for your FastAPI Docker backend.
          </p>
        </div>

        <button
          type="button"
          onClick={handleManualPing}
          disabled={isChecking}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
          <span>{isChecking ? 'Probing Backend...' : 'Ping Diagnostics'}</span>
        </button>
      </div>

      {/* Error Banner if Offline */}
      {!diagnostic.isOnline && (
        <ErrorAlert
          message={
            diagnostic.error ||
            `Cannot connect to FastAPI backend at ${API_CONFIG.BASE_URL}. Ensure Docker container 'contextvault-api' is running on the target machine.`
          }
          errors={[
            'Verify your Ubuntu server IP address matches VITE_API_BASE_URL.',
            'Confirm Docker container port mapping: 8000:8000 is open.',
            'Check firewall / UFW rules on Ubuntu: sudo ufw allow 8000/tcp',
          ]}
          isNetworkError={true}
        />
      )}

      {/* 4 Primary Diagnostic Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* 1. Overall Status */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              API Service
            </span>
            <div className="p-2 rounded-lg bg-indigo-600/10 text-indigo-400 border border-indigo-500/20">
              <Server className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center gap-2">
              {diagnostic.isOnline ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              ) : (
                <AlertCircle className="w-6 h-6 text-rose-400" />
              )}
              <span className="text-xl font-bold capitalize text-white">
                {diagnostic.status}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {diagnostic.isOnline ? 'Responding to HTTP probes' : 'Host unreachable'}
            </p>
          </div>
        </div>

        {/* 2. Round-trip Latency */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Response Latency
            </span>
            <div className="p-2 rounded-lg bg-indigo-600/10 text-indigo-400 border border-indigo-500/20">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-mono font-bold text-white">
                {diagnostic.responseTimeMs}
              </span>
              <span className="text-sm font-mono text-slate-400">ms</span>
              <span className={`text-xs font-semibold ml-2 ${latencyBadge.color}`}>
                ({latencyBadge.label})
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-400">Measured client-to-server RTT</p>
          </div>
        </div>

        {/* 3. Database State */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              SQL Server 2022
            </span>
            <div className="p-2 rounded-lg bg-indigo-600/10 text-indigo-400 border border-indigo-500/20">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <StatusBadge
              status={diagnostic.databaseStatus === 'connected' ? 'healthy' : 'offline'}
              label={
                diagnostic.databaseStatus === 'connected'
                  ? 'Database Connected'
                  : 'Database Degraded'
              }
            />
            <p className="mt-3 text-xs text-slate-400">Backend pool connection active</p>
          </div>
        </div>

        {/* 4. Version & Engine */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              API Version
            </span>
            <div className="p-2 rounded-lg bg-indigo-600/10 text-indigo-400 border border-indigo-500/20">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-mono font-bold text-white">
              v{diagnostic.version}
            </span>
            <div className="mt-1 flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-indigo-300">
                {diagnostic.environment}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Connection Architecture & Docker Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            <span>Docker Deployment & Environment Variables</span>
          </h2>

          <div className="space-y-3 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 gap-2">
              <div>
                <span className="font-semibold text-slate-300 block">VITE_API_BASE_URL</span>
                <span className="text-slate-500 font-mono text-[11px]">
                  Configured in .env file
                </span>
              </div>
              <span className="font-mono text-indigo-400 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 truncate">
                {API_CONFIG.BASE_URL}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 gap-2">
              <div>
                <span className="font-semibold text-slate-300 block">Swagger UI Endpoint</span>
                <span className="text-slate-500 font-mono text-[11px]">
                  Interactive OpenAPI browser
                </span>
              </div>
              <a
                href={`${API_CONFIG.BASE_URL}/docs`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-mono text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <span>{API_CONFIG.BASE_URL}/docs</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 gap-2">
              <div>
                <span className="font-semibold text-slate-300 block">Zero Binary Guarantee</span>
                <span className="text-slate-500 font-mono text-[11px]">
                  Brain.md Privacy Contract
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <ShieldCheck className="w-4 h-4" />
                <span>Active (Metadata & OCR Only)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Latency History Log */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h2 className="text-base font-semibold text-white flex items-center justify-between">
            <span>Recent Benchmark Pings</span>
            <span className="text-xs text-slate-500 font-normal">Last 8</span>
          </h2>

          {pingHistory.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              Click <strong className="text-slate-400">Ping Diagnostics</strong> above to record live latency samples.
            </div>
          ) : (
            <div className="space-y-2">
              {pingHistory.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-950 text-xs font-mono border border-slate-800/60"
                >
                  <span className="text-slate-400">{item.timestamp}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold">{item.latency} ms</span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        item.status === 'healthy' ? 'bg-emerald-400' : 'bg-rose-400'
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
