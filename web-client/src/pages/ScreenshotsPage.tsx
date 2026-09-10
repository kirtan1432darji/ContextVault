import React, { useState } from 'react';
import {
  Image as ImageIcon,
  Search,
  Filter,
  RefreshCw,
  Star,
  Clock,
  Tag,
  Eye,
  X,
} from 'lucide-react';
import { useVault } from '../hooks/useVault';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { Screenshot } from '../types/vault';
import { formatDate, formatBytes } from '../utils/formatters';

export const ScreenshotsPage: React.FC = () => {
  const {
    screenshots,
    totalCount,
    page,
    totalPages,
    categories,
    isLoading,
    error,
    filters,
    updateFilters,
    refetch,
  } = useVault({ pageSize: 12 });

  const [selectedScreenshot, setSelectedScreenshot] = useState<Screenshot | null>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <ImageIcon className="w-7 h-7 text-indigo-400" />
            <span>Screenshots Vault</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Browse, search OCR contents, inspect entity graphs, and audit auto-classifications.
          </p>
        </div>

        <button
          type="button"
          onClick={() => refetch()}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold border border-slate-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <ErrorAlert
          message="Failed to load screenshots from FastAPI server."
          errors={[error]}
          onDismiss={() => {}}
        />
      )}

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={filters.searchTerm || ''}
              onChange={(e) => updateFilters({ searchTerm: e.target.value })}
              placeholder="Search OCR keywords (e.g. invoice, OTP, ticket, error)..."
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500 hidden sm:inline" />
            <select
              value={filters.categoryId || ''}
              onChange={(e) => updateFilters({ categoryId: e.target.value || undefined })}
              aria-label="Filter by Smart Folder Category"
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">All Categories ({categories.length})</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Favorite filter toggle */}
          <button
            type="button"
            onClick={() =>
              updateFilters({
                isFavorite: filters.isFavorite ? undefined : true,
              })
            }
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
              filters.isFavorite
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Star className="w-3.5 h-3.5" />
            <span>Favorites</span>
          </button>
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <span>
          Showing {screenshots.length} of {totalCount} screenshots
        </span>
        <span>
          Page {page} of {totalPages}
        </span>
      </div>

      {/* Screenshots Grid */}
      {isLoading ? (
        <div className="py-20">
          <LoadingSpinner size="lg" text="Querying screenshots..." />
        </div>
      ) : screenshots.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-400">
          <ImageIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-200">No matching screenshots found</h3>
          <p className="text-xs text-slate-500 mt-1">
            Try adjusting your search keywords or removing category filters.
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
                    OCR Extracted Text
                  </span>
                  <p className="text-xs font-mono text-slate-300 line-clamp-3 leading-relaxed">
                    {sc.ocrText || 'No OCR text extracted.'}
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

                <button
                  type="button"
                  onClick={() => setSelectedScreenshot(sc)}
                  className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Inspect Metadata</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            type="button"
            disabled={page <= 1 || isLoading}
            onClick={() => updateFilters({ page: page - 1 })}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-slate-400 px-3">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || isLoading}
            onClick={() => updateFilters({ page: page + 1 })}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {selectedScreenshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-start justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-white truncate max-w-md">
                  {selectedScreenshot.fileName}
                </h3>
                <p className="text-xs text-slate-400 mt-1">ID: {selectedScreenshot.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedScreenshot(null)}
                aria-label="Close modal"
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Metadata Table */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                <span className="text-slate-500 block mb-1">Category</span>
                <span className="font-semibold text-white">
                  {selectedScreenshot.categoryName || 'Unsorted'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                <span className="text-slate-500 block mb-1">Subcategory</span>
                <span className="font-semibold text-white">
                  {selectedScreenshot.subCategory || 'General'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                <span className="text-slate-500 block mb-1">Resolution</span>
                <span className="font-mono text-white">
                  {selectedScreenshot.width} x {selectedScreenshot.height}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                <span className="text-slate-500 block mb-1">SHA-256 Hash</span>
                <span className="font-mono text-slate-400 truncate block">
                  {selectedScreenshot.fileHash}
                </span>
              </div>
            </div>

            {/* Complete OCR Text */}
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                Full Extracted OCR Tokens
              </span>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed">
                {selectedScreenshot.ocrText || 'Zero OCR text detected in image.'}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedScreenshot(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
