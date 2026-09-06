const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any',
  'are', 'aren\'t', 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below',
  'between', 'both', 'but', 'by', 'can', 'can\'t', 'cannot', 'could', 'couldn\'t',
  'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down', 'during',
  'each', 'few', 'for', 'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t', 'have',
  'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s',
  'hers', 'herself', 'him', 'himself', 'his', 'how', 'how\'s', 'i', 'i\'d', 'i\'ll',
  'i\'m', 'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself',
  'let\'s', 'me', 'more', 'most', 'mustn\'t', 'my', 'myself', 'no', 'nor', 'not', 'of',
  'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves',
  'out', 'over', 'own', 'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s',
  'should', 'shouldn\'t', 'so', 'some', 'such', 'than', 'that', 'that\'s', 'the',
  'their', 'theirs', 'them', 'themselves', 'then', 'there', 'there\'s', 'these',
  'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve', 'this', 'those', 'through',
  'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasn\'t', 'we', 'we\'d',
  'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when',
  'when\'s', 'where', 'where\'s', 'which', 'while', 'who', 'who\'s', 'whom', 'why',
  'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t', 'you', 'you\'d', 'you\'ll',
  'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves'
]);

export interface SearchIndexResult {
  normalizedText: string;
  tokens: string[];
  keywords: string[];
  entities: {
    urls: string[];
    emails: string[];
    phoneNumbers: string[];
    amounts: string[];
  };
}

export class SearchIndexService {
  /**
   * Cleans, tokenizes, and extracts searchable index metadata from raw OCR text.
   */
  prepareIndex(rawText: string): SearchIndexResult {
    if (!rawText || rawText.trim().length === 0) {
      return {
        normalizedText: '',
        tokens: [],
        keywords: [],
        entities: { urls: [], emails: [], phoneNumbers: [], amounts: [] },
      };
    }

    // 1. Extract entities before lowercasing/stripping
    const urls = rawText.match(/https?:\/\/[^\s$.?#].[^\s]*/gi) || [];
    const emails = rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi) || [];
    const phoneNumbers = rawText.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) || [];
    const amounts = rawText.match(/[$₹€£]\s?\d+(?:,\d{3})*(?:\.\d{2})?/g) || [];

    // 2. Normalized Text: lowercase, normalize whitespace
    const normalizedText = rawText
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // 3. Extract tokens and filter stopwords
    const rawTokens = normalizedText.split(/\s+/);
    const tokenSet = new Set<string>();
    const frequencyMap = new Map<string, number>();

    for (const token of rawTokens) {
      if (token.length >= 2 && !STOP_WORDS.has(token) && !/^\d+$/.test(token)) {
        tokenSet.add(token);
        frequencyMap.set(token, (frequencyMap.get(token) || 0) + 1);
      }
    }

    // 4. Rank top keywords by frequency
    const keywords = Array.from(frequencyMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([word]) => word);

    return {
      normalizedText,
      tokens: Array.from(tokenSet),
      keywords,
      entities: {
        urls: Array.from(new Set(urls)),
        emails: Array.from(new Set(emails)),
        phoneNumbers: Array.from(new Set(phoneNumbers)),
        amounts: Array.from(new Set(amounts)),
      },
    };
  }
}

export const searchIndexService = new SearchIndexService();
