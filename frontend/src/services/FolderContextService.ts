import { v4 as uuidv4 } from 'uuid';
import {
  FolderContextModel,
  FolderContextEntity,
  ContextTaskModel,
  ContextEntityModel,
  ContextDateModel,
  ContextTimelineItemModel,
  ContextEntitiesMap,
  createEmptyFolderContext,
  ScreenshotModel,
} from '../models';
import {
  folderContextRepository,
  screenshotRepository,
  classificationCacheRepository,
  ocrCacheRepository,
} from '../database/repositories';
import { useFolderContextStore } from '../store/folderContext.store';

export class FolderContextService {
  /**
   * Generates or retrieves living contextual knowledge for a smart folder.
   * Synthesizes backend AI entity extractions and on-device OCR signals.
   */
  async getOrGenerateContext(
    folderId: string,
    folderName: string,
    forceRefresh = false
  ): Promise<FolderContextModel> {
    if (!forceRefresh) {
      // 1. Try reading from SQLite cache
      const cached = await folderContextRepository.getFolderContext(folderId);
      if (cached && cached.Summary) {
        const model = this.mapEntityToModel(cached, folderName);
        useFolderContextStore.getState().setFolderContext(folderId, model);
        return model;
      }
    }

    // 2. Generate live context from folder screenshots
    return this.generateFolderContext(folderId, folderName);
  }

  /**
   * Generates living knowledge context by analyzing all screenshots within the folder.
   */
  async generateFolderContext(folderId: string, folderName: string): Promise<FolderContextModel> {
    const screenshots = await screenshotRepository.getScreenshotsByCategoryId(folderId);
    if (!screenshots || screenshots.length === 0) {
      const empty = createEmptyFolderContext(folderId, folderName, 0);
      empty.summary = `No screenshots found in ${folderName}. Take or save screenshots to generate living context.`;
      useFolderContextStore.getState().setFolderContext(folderId, empty);
      return empty;
    }

    // Extract all signals across screenshots
    const aggregatedOrgs = new Set<string>();
    const aggregatedPeople = new Set<string>();
    const aggregatedDates: ContextDateModel[] = [];
    const aggregatedUrls = new Set<string>();
    const aggregatedShopping = new Set<string>();
    const aggregatedTasks: ContextTaskModel[] = [];
    const aggregatedPayments = new Set<string>();
    const aggregatedDocs = new Set<string>();
    const aggregatedTopics = new Set<string>();
    const timelineItems: ContextTimelineItemModel[] = [];

    // Analyze each screenshot
    for (const sc of screenshots) {
      // 1. Check cached backend AI classification
      const cache = await classificationCacheRepository.getCacheByScreenshotId(sc.id);
      if (cache && cache.entitiesJson) {
        try {
          const entities = JSON.parse(cache.entitiesJson);
          (entities.merchants || []).forEach((m: string) => aggregatedOrgs.add(m));
          (entities.amounts || []).forEach((a: string) => aggregatedPayments.add(a));
          (entities.urls || []).forEach((u: string) => aggregatedUrls.add(u));
          (entities.emails || []).forEach((e: string) => aggregatedPeople.add(e));
          (entities.dates || []).forEach((d: string) => {
            aggregatedDates.push({ event: sc.fileName, date: d });
          });
          (entities.projectNames || []).forEach((p: string) => aggregatedTopics.add(p));
        } catch {}
      }

      // 2. Extract OCR text
      const ocrRecord = await ocrCacheRepository.getByScreenshotId(sc.id);
      const text = sc.ocrText || ocrRecord?.extractedText || '';

      if (text) {
        this.extractHeuristicsFromText(
          text,
          sc,
          aggregatedOrgs,
          aggregatedPeople,
          aggregatedDates,
          aggregatedUrls,
          aggregatedShopping,
          aggregatedTasks,
          aggregatedPayments,
          aggregatedDocs,
          aggregatedTopics
        );
      }

      // Add to timeline
      timelineItems.push({
        screenshotId: sc.id,
        title: sc.subcategory || sc.fileName,
        description: (text || sc.fileName).substring(0, 100).replace(/\s+/g, ' '),
        capturedAt: sc.createdAt,
        imagePath: sc.filePath,
      });

      // Collect tags / keywords
      (sc.keywords || []).forEach((kw) => aggregatedTopics.add(kw));
    }

    // Deduplicate timeline
    timelineItems.sort(
      (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime()
    );

    // Build structured entities map
    const structuredEntities: ContextEntitiesMap = {
      organizations: Array.from(aggregatedOrgs).slice(0, 10),
      people: Array.from(aggregatedPeople).slice(0, 10),
      dates: aggregatedDates.map((d) => `${d.event}: ${d.date}`).slice(0, 10),
      urls: Array.from(aggregatedUrls).slice(0, 10),
      shopping: Array.from(aggregatedShopping).slice(0, 10),
      tasks: aggregatedTasks.map((t) => t.title).slice(0, 10),
      payments: Array.from(aggregatedPayments).slice(0, 10),
      documents: Array.from(aggregatedDocs).slice(0, 10),
      amounts: Array.from(aggregatedPayments).slice(0, 10),
    };

    // Synthesize Executive Summary
    const summary = this.synthesizeSummary(
      folderName,
      screenshots.length,
      structuredEntities,
      Array.from(aggregatedTopics)
    );

    // Build ContextEntityModel list for UI
    const entityList: ContextEntityModel[] = [
      ...structuredEntities.organizations.map((name) => ({ name, type: 'Organization', count: 1 })),
      ...structuredEntities.payments.map((name) => ({ name, type: 'Payment / Amount', count: 1 })),
      ...structuredEntities.documents.map((name) => ({ name, type: 'Document / ID', count: 1 })),
      ...structuredEntities.shopping.map((name) => ({ name, type: 'Shopping Item', count: 1 })),
      ...structuredEntities.urls.map((name) => ({ name, type: 'Link', count: 1 })),
    ].slice(0, 15);

    const folderContext: FolderContextModel = {
      categoryId: folderId,
      categoryName: folderName,
      summary: summary,
      keywords: Array.from(aggregatedTopics).slice(0, 12),
      confidence: 0.92,
      screenshotCount: screenshots.length,
      lastUpdatedAt: new Date().toISOString(),
      version: 1,
      tasks: aggregatedTasks.slice(0, 8),
      entities: entityList,
      structuredEntities: structuredEntities,
      people: structuredEntities.people,
      links: structuredEntities.urls,
      dates: aggregatedDates.slice(0, 6),
      apps: Array.from(new Set(screenshots.map((s) => s.detectedApp || s.sourceApp).filter(Boolean) as string[])),
      topics: Array.from(aggregatedTopics).slice(0, 10),
      timeline: timelineItems.slice(0, 8),
      shopping: structuredEntities.shopping,
      payments: structuredEntities.payments,
      documents: structuredEntities.documents,
    };

    // 3. Save to SQLite FolderContext table
    const entityRecord: FolderContextEntity = {
      FolderId: folderId,
      Summary: summary,
      EntitiesJson: JSON.stringify(structuredEntities),
      TasksJson: JSON.stringify(folderContext.tasks),
      UpdatedOn: folderContext.lastUpdatedAt || new Date().toISOString(),
      Version: 1,
    };
    await folderContextRepository.upsertFolderContext(entityRecord);

    // 4. Update Zustand store
    useFolderContextStore.getState().setFolderContext(folderId, folderContext);

    return folderContext;
  }

  /**
   * Helper regex scanner extracting entities from screenshot OCR text.
   */
  private extractHeuristicsFromText(
    text: string,
    sc: ScreenshotModel,
    orgs: Set<string>,
    people: Set<string>,
    dates: ContextDateModel[],
    urls: Set<string>,
    shopping: Set<string>,
    tasks: ContextTaskModel[],
    payments: Set<string>,
    docs: Set<string>,
    topics: Set<string>
  ) {
    const textLower = text.toLowerCase();

    // URLs
    const urlMatches = text.match(/https?:\/\/[^\s]+|www\.[^\s]+/gi);
    if (urlMatches) {
      urlMatches.forEach((u) => urls.add(u.replace(/[,\.]$/, '')));
    }

    // Amounts / Currency
    const currencyMatches = text.match(/(?:[\$€£₹]|USD|INR|EUR|Rs\.?)\s*[0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?/gi);
    if (currencyMatches) {
      currencyMatches.forEach((c) => payments.add(c.trim()));
    }

    // Dates
    const dateMatches = text.match(/\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})\b/gi);
    if (dateMatches) {
      dateMatches.forEach((d) => dates.push({ event: sc.subcategory || sc.fileName, date: d }));
    }

    // Merchants & Orgs
    const commonVendors = [
      'Amazon', 'Flipkart', 'Starbucks', 'Uber', 'Zomato', 'Swiggy', 'Apple',
      'Google', 'Microsoft', 'Netflix', 'Spotify', 'GitHub', 'Delta', 'Walmart',
    ];
    for (const v of commonVendors) {
      if (textLower.includes(v.toLowerCase())) {
        orgs.add(v);
      }
    }

    // Action Items / Tasks
    const taskTriggers = ['to do', 'deadline:', 'due date:', 'please review', 'follow up', 'action item', 'submit before'];
    for (const trig of taskTriggers) {
      if (textLower.includes(trig)) {
        const lines = text.split('\n');
        for (const line of lines) {
          if (line.toLowerCase().includes(trig) && line.trim().length > 8) {
            tasks.push({
              id: uuidv4(),
              title: line.trim().substring(0, 75),
              isCompleted: false,
            });
            break;
          }
        }
      }
    }

    // Shopping items
    if (textLower.includes('cart') || textLower.includes('buy now') || textLower.includes('order')) {
      if (sc.subcategory) shopping.add(sc.subcategory);
    }

    // Documents (Passports, IDs, Licenses, Contracts)
    if (textLower.includes('passport') || textLower.includes('license') || textLower.includes('contract') || textLower.includes('invoice #')) {
      const docMatch = text.match(/(?:invoice|order|policy|account|license|passport)\s*#?\s*[:\-]?\s*([a-zA-Z0-9\-]+)/i);
      if (docMatch) {
        docs.add(docMatch[0].trim());
      }
    }
  }

  /**
   * Synthesizes an executive natural language summary of the folder.
   */
  private synthesizeSummary(
    folderName: string,
    count: number,
    entities: ContextEntitiesMap,
    topics: string[]
  ): string {
    const parts: string[] = [
      `This folder contains ${count} structured screenshot record${count === 1 ? '' : 's'} related to ${folderName}.`,
    ];

    if (entities.organizations.length > 0) {
      parts.push(`Key entities identified include ${entities.organizations.slice(0, 3).join(', ')}.`);
    }

    if (entities.payments.length > 0) {
      parts.push(`Recorded transactions and financial values include ${entities.payments.slice(0, 3).join(', ')}.`);
    }

    if (entities.tasks.length > 0) {
      parts.push(`Contains ${entities.tasks.length} pending action item${entities.tasks.length === 1 ? '' : 's'} awaiting attention.`);
    }

    if (topics.length > 0) {
      parts.push(`Dominant topics include ${topics.slice(0, 4).join(', ')}.`);
    }

    return parts.join(' ');
  }

  private mapEntityToModel(entity: FolderContextEntity, folderName: string): FolderContextModel {
    let structured: ContextEntitiesMap = {
      organizations: [],
      people: [],
      dates: [],
      urls: [],
      shopping: [],
      tasks: [],
      payments: [],
      documents: [],
      amounts: [],
    };
    try {
      if (entity.EntitiesJson) structured = JSON.parse(entity.EntitiesJson);
    } catch {}

    let tasks: ContextTaskModel[] = [];
    try {
      if (entity.TasksJson) tasks = JSON.parse(entity.TasksJson);
    } catch {}

    const entityList: ContextEntityModel[] = [
      ...structured.organizations.map((name) => ({ name, type: 'Organization', count: 1 })),
      ...structured.payments.map((name) => ({ name, type: 'Payment / Amount', count: 1 })),
      ...structured.documents.map((name) => ({ name, type: 'Document / ID', count: 1 })),
      ...structured.shopping.map((name) => ({ name, type: 'Shopping Item', count: 1 })),
      ...structured.urls.map((name) => ({ name, type: 'Link', count: 1 })),
    ].slice(0, 15);

    return {
      categoryId: entity.FolderId,
      categoryName: folderName,
      summary: entity.Summary,
      keywords: structured.organizations.concat(structured.shopping),
      confidence: 0.95,
      screenshotCount: 0,
      lastUpdatedAt: entity.UpdatedOn,
      version: entity.Version,
      tasks: tasks,
      entities: entityList,
      structuredEntities: structured,
      people: structured.people,
      links: structured.urls,
      dates: structured.dates.map((d) => ({ event: 'Recorded Event', date: d })),
      apps: [],
      topics: structured.organizations,
      timeline: [],
      shopping: structured.shopping,
      payments: structured.payments,
      documents: structured.documents,
    };
  }
}

export const folderContextService = new FolderContextService();
