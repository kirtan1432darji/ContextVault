import { databaseService } from '../database';
import { categoryRepository } from '../database/repositories/categoryRepository';
import { classificationCacheRepository } from '../database/repositories/classificationCacheRepository';

export interface FolderCategoryStat {
  categoryId: string;
  categoryName: string;
  count: number;
  totalSizeBytes: number;
  percentageOfTotal: number;
  confidenceAverage: number;
  colorHex: string;
  iconName: string;
}

export interface ConfidenceTierStat {
  tier: 'high' | 'medium' | 'low';
  label: string;
  count: number;
  percentage: number;
  description: string;
  color: string;
}

export interface EntityTallyStat {
  totalEntities: number;
  amountsCount: number;
  merchantsCount: number;
  datesCount: number;
  urlsCount: number;
  emailsCount: number;
}

export interface SourceAppStat {
  appName: string;
  count: number;
  percentage: number;
}

export interface FolderAnalyticsOverview {
  totalScreenshots: number;
  totalStorageBytes: number;
  averageConfidence: number;
  categories: FolderCategoryStat[];
  confidenceTiers: ConfidenceTierStat[];
  entitiesTally: EntityTallyStat;
  sourceApps: SourceAppStat[];
  needsReviewCount: number;
  manualReclassifiedCount: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  Finance: '#10B981',
  Work: '#3B82F6',
  Receipts: '#F59E0B',
  Social: '#EC4899',
  Personal: '#8B5CF6',
  Travel: '#06B6D4',
  Health: '#EF4444',
  Projects: '#6366F1',
  Unsorted: '#9CA3AF',
};

export class FolderAnalyticsService {
  /**
   * Aggregates SQLite database metrics to generate a comprehensive folder analytics report.
   */
  async getAnalyticsOverview(filterCategoryId?: string): Promise<FolderAnalyticsOverview> {
    const whereClause = filterCategoryId
      ? `WHERE category_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)`
      : `WHERE (is_deleted = 0 OR is_deleted IS NULL)`;
    const params = filterCategoryId ? [filterCategoryId] : [];

    // 1. Total count, storage size, average confidence
    const totalQuery = `
      SELECT 
        COUNT(*) as total_count,
        COALESCE(SUM(file_size), 0) as total_size,
        COALESCE(AVG(confidence), 0) as avg_confidence
      FROM screenshots
      ${whereClause}
    `;
    const totalRows = await databaseService.executeQuery(totalQuery, params);
    const totalScreenshots = totalRows[0]?.total_count || 0;
    const totalStorageBytes = totalRows[0]?.total_size || 0;
    const averageConfidence = +(totalRows[0]?.avg_confidence || 0).toFixed(2);

    // 2. Category Distribution
    const catQuery = `
      SELECT 
        category_id, 
        category_name, 
        COUNT(*) as count, 
        COALESCE(SUM(file_size), 0) as total_size,
        COALESCE(AVG(confidence), 0) as avg_confidence
      FROM screenshots
      ${whereClause}
      GROUP BY category_id, category_name
      ORDER BY count DESC
    `;
    const catRows = await databaseService.executeQuery(catQuery, params);

    const allCategories = await categoryRepository.getAllCategories();
    const catMap = new Map<string, any>();
    allCategories.forEach((c) => catMap.set(c.id, c));

    const categories: FolderCategoryStat[] = catRows.map((r: any) => {
      const count = r.count || 0;
      const catMeta = catMap.get(r.category_id);
      const name = r.category_name || catMeta?.name || 'Unsorted';
      const percentage = totalScreenshots > 0 ? +((count / totalScreenshots) * 100).toFixed(1) : 0;
      const colorHex = catMeta?.colorHex || CATEGORY_COLORS[name] || '#6366F1';
      const iconName = catMeta?.iconName || 'folder-outline';

      return {
        categoryId: r.category_id,
        categoryName: name,
        count,
        totalSizeBytes: r.total_size || 0,
        percentageOfTotal: percentage,
        confidenceAverage: +(r.avg_confidence || 0).toFixed(2),
        colorHex: colorHex.startsWith('#') ? colorHex : `#${colorHex}`,
        iconName,
      };
    });

    // 3. Confidence Tiers Breakdown
    // High Tier (>= 0.90)
    const highQuery = `
      SELECT COUNT(*) as count FROM screenshots
      ${whereClause} ${filterCategoryId ? 'AND' : 'WHERE'} confidence >= 0.90
    `;
    const highRows = await databaseService.executeQuery(highQuery, params);
    const highCount = highRows[0]?.count || 0;

    // Medium Tier (0.70 <= confidence < 0.90)
    const medQuery = `
      SELECT COUNT(*) as count FROM screenshots
      ${whereClause} ${filterCategoryId ? 'AND' : 'WHERE'} confidence >= 0.70 AND confidence < 0.90
    `;
    const medRows = await databaseService.executeQuery(medQuery, params);
    const medCount = medRows[0]?.count || 0;

    // Low / Needs Review (< 0.70 or unsorted)
    const lowQuery = `
      SELECT COUNT(*) as count FROM screenshots
      ${whereClause} ${filterCategoryId ? 'AND' : 'WHERE'} (confidence < 0.70 OR category_id = 'unsorted')
    `;
    const lowRows = await databaseService.executeQuery(lowQuery, params);
    const lowCount = lowRows[0]?.count || 0;

    const confidenceTiers: ConfidenceTierStat[] = [
      {
        tier: 'high',
        label: 'High Confidence (>90%)',
        count: highCount,
        percentage: totalScreenshots > 0 ? +((highCount / totalScreenshots) * 100).toFixed(1) : 0,
        description: 'Auto-categorized with high precision',
        color: '#10B981',
      },
      {
        tier: 'medium',
        label: 'Medium Confidence (70-90%)',
        count: medCount,
        percentage: totalScreenshots > 0 ? +((medCount / totalScreenshots) * 100).toFixed(1) : 0,
        description: 'Standard heuristic and OCR match',
        color: '#3B82F6',
      },
      {
        tier: 'low',
        label: 'Needs Review (<70%)',
        count: lowCount,
        percentage: totalScreenshots > 0 ? +((lowCount / totalScreenshots) * 100).toFixed(1) : 0,
        description: 'Unsorted or ambiguous items',
        color: '#F59E0B',
      },
    ];

    // 4. Manually Reclassified Count
    const manualQuery = `
      SELECT COUNT(*) as count FROM screenshots
      ${whereClause} ${filterCategoryId ? 'AND' : 'WHERE'} (classification_source = 'manual' OR is_auto_categorized = 0)
    `;
    const manualRows = await databaseService.executeQuery(manualQuery, params);
    const manualReclassifiedCount = manualRows[0]?.count || 0;

    // 5. Source Apps Breakdown (Top 5)
    const appsQuery = `
      SELECT 
        COALESCE(detected_app, source_app, 'System/Camera') as app_name, 
        COUNT(*) as count 
      FROM screenshots 
      ${whereClause}
      GROUP BY app_name
      ORDER BY count DESC
      LIMIT 5
    `;
    const appsRows = await databaseService.executeQuery(appsQuery, params);
    const sourceApps: SourceAppStat[] = appsRows.map((r: any) => ({
      appName: r.app_name || 'System/Camera',
      count: r.count || 0,
      percentage: totalScreenshots > 0 ? +(((r.count || 0) / totalScreenshots) * 100).toFixed(1) : 0,
    }));

    // 6. Extracted Entities Tally
    let amountsCount = 0;
    let merchantsCount = 0;
    let datesCount = 0;
    let urlsCount = 0;
    let emailsCount = 0;

    try {
      const cacheRecords = await classificationCacheRepository.getAll();
      for (const rec of cacheRecords) {
        if (rec.entitiesJson) {
          try {
            const parsed = JSON.parse(rec.entitiesJson);
            if (Array.isArray(parsed.amounts)) amountsCount += parsed.amounts.length;
            if (Array.isArray(parsed.merchants)) merchantsCount += parsed.merchants.length;
            if (Array.isArray(parsed.dates)) datesCount += parsed.dates.length;
            if (Array.isArray(parsed.urls)) urlsCount += parsed.urls.length;
            if (Array.isArray(parsed.emails)) emailsCount += parsed.emails.length;
          } catch {}
        }
      }
    } catch {
      // Fallback
    }

    const totalEntities = amountsCount + merchantsCount + datesCount + urlsCount + emailsCount;

    return {
      totalScreenshots,
      totalStorageBytes,
      averageConfidence,
      categories,
      confidenceTiers,
      entitiesTally: {
        totalEntities,
        amountsCount,
        merchantsCount,
        datesCount,
        urlsCount,
        emailsCount,
      },
      sourceApps,
      needsReviewCount: lowCount,
      manualReclassifiedCount,
    };
  }
}

export const folderAnalyticsService = new FolderAnalyticsService();
