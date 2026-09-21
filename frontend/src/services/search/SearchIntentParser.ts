export type SearchDomain =
  | 'finance'
  | 'shopping'
  | 'food'
  | 'travel'
  | 'documents'
  | 'chats'
  | 'code'
  | 'work'
  | 'general';

export interface ParsedAmountRange {
  min?: number;
  max?: number;
  exact?: number;
}

export interface ParsedDateRange {
  from?: string;
  to?: string;
  relative?: 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'specific_month';
  monthName?: string;
}

export interface ParsedSearchIntent {
  rawQuery: string;
  cleanedQuery: string;
  domain: SearchDomain;
  merchant?: string;
  amountRange?: ParsedAmountRange;
  dateRange?: ParsedDateRange;
  documentType?: string;
  categoryId?: string;
  categoryName?: string;
  tags: string[];
  keywords: string[];
  isQuestion: boolean;
}

const KNOWN_MERCHANTS: Record<string, string> = {
  phonepe: 'PhonePe',
  'phone pe': 'PhonePe',
  gpay: 'Google Pay',
  'google pay': 'Google Pay',
  paytm: 'Paytm',
  swiggy: 'Swiggy',
  zomato: 'Zomato',
  amazon: 'Amazon',
  flipkart: 'Flipkart',
  myntra: 'Myntra',
  meesho: 'Meesho',
  uber: 'Uber',
  ola: 'Ola',
  irctc: 'IRCTC',
  makemytrip: 'MakeMyTrip',
  mmt: 'MakeMyTrip',
  bookmyshow: 'BookMyShow',
  bms: 'BookMyShow',
  zepto: 'Zepto',
  blinkit: 'Blinkit',
  instamart: 'Instamart',
  bigbasket: 'BigBasket',
  sbi: 'SBI',
  hdfc: 'HDFC',
  icici: 'ICICI',
  axis: 'Axis Bank',
  cred: 'Cred',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  netflix: 'Netflix',
  spotify: 'Spotify',
  apple: 'Apple',
  google: 'Google',
};

const MONTH_NAMES: Record<string, number> = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};

const STOP_WORDS = new Set([
  'show', 'me', 'all', 'find', 'get', 'search', 'screenshots', 'screenshot',
  'images', 'photos', 'pics', 'with', 'from', 'in', 'at', 'for', 'of', 'the',
  'a', 'an', 'and', 'or', 'to', 'is', 'are', 'was', 'were', 'my', 'please',
  'list', 'display', 'view', 'any', 'some', 'having', 'which', 'that',
]);

export class SearchIntentParser {
  /**
   * Parses natural-language search queries into structured semantic search intent.
   */
  parse(rawQuery: string): ParsedSearchIntent {
    const raw = (rawQuery || '').trim();
    const lower = raw.toLowerCase();

    let cleaned = lower;
    let domain: SearchDomain = 'general';
    let merchant: string | undefined;
    let documentType: string | undefined;
    let categoryId: string | undefined;
    let categoryName: string | undefined;
    const tags: string[] = [];

    const isQuestion = /^(what|when|where|how|which|who|can|show|did|is|are|find)\b/i.test(raw) || raw.endsWith('?');

    // 1. Merchant Detection
    for (const [key, name] of Object.entries(KNOWN_MERCHANTS)) {
      const regex = new RegExp(`\\b${key}\\b`, 'i');
      if (regex.test(lower)) {
        merchant = name;
        tags.push(name.toLowerCase());
        cleaned = cleaned.replace(regex, ' ');
        break;
      }
    }

    // 2. Document Type Detection
    if (/\b(aadhaar|aadhar|uidai)\b/i.test(lower)) {
      documentType = 'aadhaar';
      domain = 'documents';
      tags.push('aadhaar', 'id');
      cleaned = cleaned.replace(/\b(aadhaar|aadhar|uidai)\b/gi, ' ');
    } else if (/\b(pan|pan card)\b/i.test(lower)) {
      documentType = 'pan';
      domain = 'documents';
      tags.push('pan', 'id');
      cleaned = cleaned.replace(/\b(pan|pan card)\b/gi, ' ');
    } else if (/\b(passport)\b/i.test(lower)) {
      documentType = 'passport';
      domain = 'documents';
      tags.push('passport', 'id');
      cleaned = cleaned.replace(/\bpassport\b/gi, ' ');
    } else if (/\b(driving licen[sc]e|driving lic|dl)\b/i.test(lower)) {
      documentType = 'driving_licence';
      domain = 'documents';
      tags.push('driving_licence', 'id');
      cleaned = cleaned.replace(/\b(driving licen[sc]e|driving lic|dl)\b/gi, ' ');
    } else if (/\b(voter id|voter card|epic)\b/i.test(lower)) {
      documentType = 'voter_id';
      domain = 'documents';
      tags.push('voter_id', 'id');
      cleaned = cleaned.replace(/\b(voter id|voter card|epic)\b/gi, ' ');
    } else if (/\b(pnr|tickets?|boarding pass(?:es)?|flights?|trains?|railway)\b/i.test(lower)) {
      documentType = 'ticket';
      domain = 'travel';
      categoryId = 'travel_transit';
      categoryName = 'Travel & Transit';
      tags.push('travel', 'ticket');
    } else if (/\b(invoices?|bills?|receipts?|tax invoices?)\b/i.test(lower)) {
      documentType = 'receipt';
      tags.push('receipt');
    }

    // 3. Domain Detection (if not already set by document)
    if (domain === 'general') {
      if (
        /\b(upi|payments?|paid|transferred|transfers?|transactions?|bills?|recharges?|salary|credited|debited|wallet|statements?)\b/i.test(lower) ||
        ['PhonePe', 'Google Pay', 'Paytm', 'SBI', 'HDFC', 'ICICI', 'Axis Bank', 'Cred'].includes(merchant || '')
      ) {
        domain = 'finance';
        categoryId = 'finance_bills';
        categoryName = 'Finance & Bills';
        tags.push('finance');
      } else if (
        /\b(food|swiggy|zomato|orders?|meals?|restaurants?|dine|dining|cafe|delivery|deliveries|burgers?|pizzas?|biryani)\b/i.test(lower) ||
        ['Swiggy', 'Zomato'].includes(merchant || '')
      ) {
        domain = 'food';
        categoryId = 'food_dining';
        categoryName = 'Food & Dining';
        tags.push('food');
      } else if (
        /\b(amazon|flipkart|myntra|meesho|shopping|orders?|cart|delivered|shipments?|packages?|products?)\b/i.test(lower) ||
        ['Amazon', 'Flipkart', 'Myntra', 'Meesho'].includes(merchant || '')
      ) {
        domain = 'shopping';
        categoryId = 'shopping_orders';
        categoryName = 'Shopping & Orders';
        tags.push('shopping');
      } else if (
        /\b(flights?|trains?|hotels?|bookings?|irctc|uber|ola|travel|trips?|pnr|transit|airports?|boarding)\b/i.test(lower) ||
        ['Uber', 'Ola', 'IRCTC', 'MakeMyTrip'].includes(merchant || '')
      ) {
        domain = 'travel';
        categoryId = 'travel_transit';
        categoryName = 'Travel & Transit';
        tags.push('travel');
      } else if (
        /\b(whatsapp|telegram|chats?|conversations?|messages?|dm|sms|teams|slack)\b/i.test(lower) ||
        ['WhatsApp', 'Telegram'].includes(merchant || '')
      ) {
        domain = 'chats';
        categoryId = 'social_chat';
        categoryName = 'Chats & Social';
        tags.push('chat');
      } else if (/\b(code|git|github|bug|terminal|error|function|api|react|python|flutter)\b/i.test(lower)) {
        domain = 'code';
        categoryId = 'code_dev';
        categoryName = 'Code & Development';
        tags.push('code');
      } else if (/\b(work|meeting|agenda|project|task|presentation|slide|resume)\b/i.test(lower)) {
        domain = 'work';
        categoryId = 'work_docs';
        categoryName = 'Work & Documents';
        tags.push('work');
      } else if (documentType) {
        domain = 'documents';
        categoryId = 'personal_docs';
        categoryName = 'Identity & Documents';
      }
    }

    // 4. Amount Range Parsing
    const amountRange = this.parseAmount(lower);
    if (amountRange) {
      // Remove parsed amount phrases from cleaned
      cleaned = cleaned
        .replace(/(?:between|from)?\s*(?:₹|rs\.?|inr)?\s*\d+(?:\.\d+)?\s*(?:to|and|-)\s*(?:₹|rs\.?|inr)?\s*\d+(?:\.\d+)?/gi, ' ')
        .replace(/(?:above|over|more than|>|greater than)\s*(?:₹|rs\.?|inr)?\s*\d+(?:\.\d+)?/gi, ' ')
        .replace(/(?:under|below|less than|<)\s*(?:₹|rs\.?|inr)?\s*\d+(?:\.\d+)?/gi, ' ')
        .replace(/(?:₹|rs\.?|inr)\s*\d+(?:\.\d+)?/gi, ' ');
    }

    // 5. Date Range Parsing
    const dateRange = this.parseDate(lower);
    if (dateRange) {
      cleaned = cleaned
        .replace(/\b(today|yesterday|last week|past week|this week|current week|this month|last month)(?:'s)?\b/gi, ' ');
      if (dateRange.monthName) {
        cleaned = cleaned.replace(new RegExp(`\\b${dateRange.monthName}(?:'s)?\\b`, 'gi'), ' ');
      }
    }

    // 6. Clean Keywords
    const tokens = cleaned
      .replace(/[^\w\s₹]/gi, ' ')
      .split(/\s+/)
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 1 && !STOP_WORDS.has(t));

    const uniqueKeywords = Array.from(new Set(tokens));
    tokens.forEach((t) => {
      if (t.endsWith('s') && t.length > 3) {
        uniqueKeywords.push(t.slice(0, -1));
      }
    });
    if (uniqueKeywords.length === 0 && raw.trim()) {
      uniqueKeywords.push(raw.trim().toLowerCase());
    }

    return {
      rawQuery: raw,
      cleanedQuery: uniqueKeywords.join(' ') || raw,
      domain,
      merchant,
      amountRange,
      dateRange,
      documentType,
      categoryId,
      categoryName,
      tags: Array.from(new Set(tags)),
      keywords: uniqueKeywords,
      isQuestion,
    };
  }

  private parseAmount(text: string): ParsedAmountRange | undefined {
    // 1. Between X and Y or X to Y (e.g., between 200 and 500, between ₹200–500, 200 to 500)
    const betweenMatch = text.match(
      /(?:between|from)?\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:to|and|-)\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)/i
    );
    if (betweenMatch) {
      const min = parseFloat(betweenMatch[1]);
      const max = parseFloat(betweenMatch[2]);
      return { min: Math.min(min, max), max: Math.max(min, max) };
    }

    // 2. Above / Over / More than / Greater than / >
    const aboveMatch = text.match(/(?:above|over|more than|greater than|>)\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)/i);
    if (aboveMatch) {
      return { min: parseFloat(aboveMatch[1]) };
    }

    // 3. Under / Below / Less than / <
    const underMatch = text.match(/(?:under|below|less than|<)\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)/i);
    if (underMatch) {
      return { max: parseFloat(underMatch[1]) };
    }

    // 4. Exact amount e.g. ₹500, Rs. 500, INR 1200
    const exactMatch = text.match(/(?:₹|rs\.?|inr)\s*(\d+(?:\.\d+)?)/i);
    if (exactMatch) {
      return { exact: parseFloat(exactMatch[1]) };
    }

    return undefined;
  }

  private parseDate(text: string): ParsedDateRange | undefined {
    const now = new Date();

    if (/\btoday\b/i.test(text)) {
      const todayStr = now.toISOString().split('T')[0];
      return { from: todayStr, relative: 'today' };
    }

    if (/\byesterday\b/i.test(text)) {
      const yest = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const yestStr = yest.toISOString().split('T')[0];
      return { from: yestStr, to: yestStr, relative: 'yesterday' };
    }

    if (/\b(this week|current week)\b/i.test(text)) {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { from: weekAgo.toISOString().split('T')[0], to: now.toISOString().split('T')[0], relative: 'this_week' };
    }

    if (/\b(last week|past week|7 days)\b/i.test(text)) {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { from: weekAgo.toISOString().split('T')[0], relative: 'last_week' };
    }

    if (/\bthis month\b/i.test(text)) {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: monthStart.toISOString().split('T')[0], relative: 'this_month' };
    }

    if (/\blast month\b/i.test(text)) {
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        from: lastMonthStart.toISOString().split('T')[0],
        to: lastMonthEnd.toISOString().split('T')[0],
        relative: 'last_month',
      };
    }

    // Specific month name (e.g. September, Aug)
    for (const [monthKey, monthIdx] of Object.entries(MONTH_NAMES)) {
      const regex = new RegExp(`\\b${monthKey}\\b`, 'i');
      if (regex.test(text)) {
        const year = now.getFullYear();
        const start = new Date(year, monthIdx, 1).toISOString().split('T')[0];
        const end = new Date(year, monthIdx + 1, 0).toISOString().split('T')[0];
        return {
          from: start,
          to: end,
          relative: 'specific_month',
          monthName: monthKey,
        };
      }
    }

    return undefined;
  }
}

export const searchIntentParser = new SearchIntentParser();
