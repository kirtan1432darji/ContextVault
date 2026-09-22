import { searchRepository } from '../../database/repositories/searchRepository';
import { categoryRepository } from '../../database/repositories/categoryRepository';

const POPULAR_MERCHANTS = [
  'PhonePe',
  'Swiggy',
  'Zomato',
  'Amazon',
  'Flipkart',
  'Google Pay',
  'Paytm',
  'Uber',
  'IRCTC',
  'MakeMyTrip',
  'Myntra',
  'BookMyShow',
  'SBI',
  'HDFC',
  'Aadhaar',
  'PAN Card',
];

const DEFAULT_SUGGESTIONS = [
  'PhonePe payments above ₹500',
  'Swiggy orders',
  'Aadhaar card screenshot',
  'Flight tickets to Delhi',
  'Amazon receipts from last month',
  'Zomato dinner delivery',
  'IRCTC train booking',
  'PAN card photo',
];

export class SearchSuggestionService {
  /**
   * Returns contextual real-time suggestions based on current user input.
   */
  async getSuggestions(input: string, limit = 8): Promise<string[]> {
    const trimmed = (input || '').trim().toLowerCase();

    if (!trimmed) {
      // If empty input, return recent searches first, followed by default suggestions
      try {
        const recents = await searchRepository.getRecentSearches(4);
        const recentQueries = recents.map((r) => r.query);
        const combined = Array.from(new Set([...recentQueries, ...DEFAULT_SUGGESTIONS]));
        return combined.slice(0, limit);
      } catch {
        return DEFAULT_SUGGESTIONS.slice(0, limit);
      }
    }

    const suggestions = new Set<string>();

    // 1. Check recent searches matching prefix
    try {
      const recents = await searchRepository.getRecentSearches(15);
      for (const r of recents) {
        if (r.query.toLowerCase().includes(trimmed) && r.query.toLowerCase() !== trimmed) {
          suggestions.add(r.query);
        }
      }
    } catch {}

    // 2. Merchant match templates
    for (const merchant of POPULAR_MERCHANTS) {
      const mLower = merchant.toLowerCase();
      if (mLower.startsWith(trimmed) || mLower.includes(trimmed)) {
        suggestions.add(merchant);
        suggestions.add(`${merchant} payments`);
        suggestions.add(`${merchant} receipts`);
      }
    }

    // 3. Category match
    try {
      const categories = await categoryRepository.getAllCategories();
      for (const cat of categories) {
        if (cat.name.toLowerCase().includes(trimmed)) {
          suggestions.add(cat.name);
        }
      }
    } catch {}

    // 4. Fallback contextual queries if match is found
    for (const def of DEFAULT_SUGGESTIONS) {
      if (def.toLowerCase().includes(trimmed)) {
        suggestions.add(def);
      }
    }

    return Array.from(suggestions).slice(0, limit);
  }
}

export const searchSuggestionService = new SearchSuggestionService();
