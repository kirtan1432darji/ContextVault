import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Image as ImageIcon,
  Folder,
  Sparkles,
  RefreshCw,
  Search,
  CheckCircle,
  Eye,
  FileText,
  Tag,
  Clock,
} from 'lucide-react';
import { useVault } from '../hooks/useVault';
import { useAuth } from '../hooks/useAuth';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { ROUTES } from '../utils/constants';
import { formatDate, formatBytes, truncateText } from '../utils/formatters';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const {
    categories,
    screenshots,
    totalCount,
    isLoading,
    error,
    refetch,
    filters,
    updateFilters,
  } = useVault({ pageSize: 6 });

  // Calculate statistics
  const stats = useMemo(() => {
    const categorized = screenshots.filter((s) => s.categoryId && s.categoryId !== 'unsorted').length;
    const matchRate = totalCount > 0 ? Math.round((categorized / totalCount) * 100) : 0;
    return {
      total: totalCount,
      categorized,
      matchRate,
      activeFolders: categories.length,
    };
  }, [screenshots, totalCount, categories]);

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Welcome back,</span>
            <span className="text-indigo-400">{user?.username || 'Researcher'}</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Real-time overview of your encrypted on-device screenshot metadata and smart folders.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold border border-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Vault</span>
          </button>

          <Link
            to={ROUTES.SCREENSHOTS}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-md shadow-indigo-600/20 transition-colors"
          >
            <span>Browse All</span>
          </Link>
        </div>
      </div>

      {error && (
        <ErrorAlert
          message="Failed to synchronize data from FastAPI backend."
          errors={[error]}
          onDismiss={() => {}}
        />
      )}

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Total Screenshots
            </span>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <ImageIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold text-white">{stats.total}</span>
            <p className="mt-1 text-xs text-slate-500">Indexed on FastAPI database</p>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Auto-Classified
            </span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold text-white">{stats.categorized}</span>
            <p className="mt-1 text-xs text-slate-500">Structured into categories</p>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Classification Match
            </span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold text-white">{stats.matchRate}%</span>
            <p className="mt-1 text-xs text-slate-500">Heuristic accuracy score</p>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Smart Folders
            </span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Folder className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold text-white">{stats.activeFolders}</span>
            <p className="mt-1 text-xs text-slate-500">Canonical taxonomy trees</p>
          </div>
        </div>
      </div>

      {/* Quick Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={filters.searchTerm || ''}
            onChange={(e) => updateFilters({ searchTerm: e.target.value })}
            placeholder="Search across OCR extracted text, merchants, errors, flight numbers..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Smart Folders Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Folder className="w-5 h-5 text-indigo-400" />
            <span>Smart Folders Taxonomy</span>
          </h2>
          <span className="text-xs text-slate-500">{categories.length} canonical categories</span>
        </div>

        {categories.length === 0 && !isLoading ? (
          <div className="p-8 text-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-500 text-sm">
            No categories returned from backend. Ensure database migrations are seeded.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {categories.slice(0, 6).map((cat) => (
              <div
                key={cat.id}
                className="p-4 rounded-xl bg-slate-900 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold mb-2.5"
                    style={{
                      backgroundColor: `${cat.colorHex || '#6366f1'}20`,
                      color: cat.colorHex || '#6366f1',
                    }}
                  >
                    <Folder className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-white leading-snug truncate">
                    {cat.name}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                    {cat.description || 'Auto-classified screenshots'}
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                  <span>{cat.screenshotCount || 0} items</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Screenshots Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-indigo-400" />
            <span>Recent Screenshot Ingestions</span>
          </h2>
          <Link
            to={ROUTES.SCREENSHOTS}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
          >
            View All ({totalCount}) &rarr;
          </Link>
        </div>

        {isLoading ? (
          <div className="py-12">
            <LoadingSpinner text="Loading recent screenshots from FastAPI..." />
          </div>
        ) : screenshots.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-400">
            <FileText className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-300">No screenshots found</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Screenshots will populate automatically as on-device OCR metadata is synchronized.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {screenshots.map((sc) => (
              <div
                key={sc.id}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-all shadow-sm"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-white truncate" title={sc.fileName}>
                        {sc.fileName}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(sc.createdAt)}</span>
                        <span>&bull;</span>
                        <span>{formatBytes(sc.fileSize)}</span>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      {sc.categoryName || sc.subCategory || 'Unsorted'}
                    </span>
                  </div>

                  {/* OCR Text Snippet */}
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80">
                    <span className="text-[10px] uppercase font-semibold text-slate-500 block mb-1">
                      OCR Extracted Tokens
                    </span>
                    <p className="text-xs font-mono text-slate-300 leading-relaxed">
                      {sc.ocrText ? truncateText(sc.ocrText, 110) : 'No OCR text detected.'}
                    </p>
                  </div>

                  {/* Tags */}
                  {sc.tags && sc.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {sc.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300"
                        >
                          <Tag className="w-2.5 h-2.5 text-slate-500" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span className="font-mono text-[11px]">
                    {sc.width}x{sc.height}
                  </span>
                  <Link
                    to={`${ROUTES.SCREENSHOTS}?id=${sc.id}`}
                    className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Detail</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
