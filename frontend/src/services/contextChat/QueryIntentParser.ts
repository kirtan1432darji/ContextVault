/**
 * QueryIntentParser.ts
 * Natural Language Query Parser for ContextVault Context Chat.
 * Classifies user questions into structured domain intents, extracting
 * merchants, amounts, thresholds, dates, document types, and filter parameters.
 */

export type QueryDomain =
  | 'finance'
  | 'travel'
  | 'food_delivery'
  | 'documents'
  | 'chats'
  | 'shopping'
  | 'entertainment'
  | 'health'
  | 'education'
  | 'work'
  | 'utilities'
  | 'general';

export interface ParsedQueryIntent {
  domain: QueryDomain;
  intentType:
    | 'payment_query'
    | 'merchant_query'
    | 'ticket_query'
    | 'pnr_query'
    | 'document_query'
    | 'chat_query'
    | 'date_query'
    | 'folder_summary'
    | 'general_search';
  merchant?: string;
  minAmount?: number;
  maxAmount?: number;
  currency?: string;
  documentType?: string;
  travelType?: 'flight' | 'train' | 'bus' | 'hotel' | 'general';
  pnr?: string;
  dateRange?: {
    from?: string;
    to?: string;
    relative?: 'today' | 'yesterday' | 'this_week' | 'this_month';
  };
  categoryFilter?: string;
  appFilter?: string;
  keywords: string[];
  rawQuery: string;
}

const KNOWN_MERCHANTS: Record<string, QueryDomain> = {
  phonepe: 'finance',
  paytm: 'finance',
  'google pay': 'finance',
  gpay: 'finance',
  cred: 'finance',
  bhim: 'finance',
  razorpay: 'finance',
  hdfc: 'finance',
  sbi: 'finance',
  icici: 'finance',
  axis: 'finance',
  kotak: 'finance',
  swiggy: 'food_delivery',
  zomato: 'food_delivery',
  blinkit: 'food_delivery',
  zepto: 'food_delivery',
  amazon: 'shopping',
  flipkart: 'shopping',
  myntra: 'shopping',
  meesho: 'shopping',
  ajio: 'shopping',
  nykaa: 'shopping',
  indigo: 'travel',
  'air india': 'travel',
  irctc: 'travel',
  makemytrip: 'travel',
  uber: 'travel',
  ola: 'travel',
  whatsapp: 'chats',
  telegram: 'chats',
  slack: 'work',
  jira: 'work',
  netflix: 'entertainment',
  spotify: 'entertainment',
  youtube: 'entertainment',
  apollo: 'health',
  practo: 'health',
  coursera: 'education',
  udemy: 'education',
};

const DOC_TYPES = [
  'aadhaar',
  'aadhar',
  'pan',
  'pan card',
  'passport',
  'driving license',
  'driver license',
  'voter id',
  'marksheet',
  'certificate',
  'invoice',
  'contract',
  'id card',
];

export class QueryIntentParser {
  static parse(query: string): ParsedQueryIntent {
    const q = (query || '').trim().toLowerCase();
    const keywords: string[] = [];

    // 1. Check for Summary Intents
    if (q.includes('summarize') || q.includes('summary') || q.includes('overview')) {
      if (q.includes('today')) {
        return {
          domain: 'general',
          intentType: 'folder_summary',
          dateRange: { relative: 'today' },
          keywords: ['today', 'summary'],
          rawQuery: query,
        };
      }
      if (q.includes('yesterday')) {
        return {
          domain: 'general',
          intentType: 'folder_summary',
          dateRange: { relative: 'yesterday' },
          keywords: ['yesterday', 'summary'],
          rawQuery: query,
        };
      }
    }

    // 2. Extract Amount & Thresholds (e.g. above 500, > ₹500, less than 1000)
    let minAmount: number | undefined;
    let maxAmount: number | undefined;

    const aboveMatch = q.match(/(?:above|more than|greater than|>|over|at least|minimum)\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)/i);
    if (aboveMatch) {
      minAmount = parseFloat(aboveMatch[1].replace(/,/g, ''));
    }

    const belowMatch = q.match(/(?:below|less than|under|<|maximum|up to)\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)/i);
    if (belowMatch) {
      maxAmount = parseFloat(belowMatch[1].replace(/,/g, ''));
    }

    // Exact amount without condition: "₹550" or "Rs 550"
    if (minAmount === undefined && maxAmount === undefined) {
      const exactAmt = q.match(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d+)?)/i);
      if (exactAmt) {
        const val = parseFloat(exactAmt[1].replace(/,/g, ''));
        minAmount = val;
        maxAmount = val;
      }
    }

    // 3. Extract Merchant or Brand
    let matchedMerchant: string | undefined;
    let merchantDomain: QueryDomain | undefined;

    for (const [mName, mDomain] of Object.entries(KNOWN_MERCHANTS)) {
      const escaped = mName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`(^|[^a-zA-Z0-9])${escaped}([^a-zA-Z0-9]|$)`, 'i').test(q)) {
        matchedMerchant = mName.charAt(0).toUpperCase() + mName.slice(1);
        merchantDomain = mDomain;
        keywords.push(mName);
        break;
      }
    }

    // 4. Extract Document Type
    let matchedDoc: string | undefined;
    for (const dt of DOC_TYPES) {
      if (q.includes(dt)) {
        matchedDoc = dt.replace(/\s+/g, '_');
        keywords.push(dt);
        break;
      }
    }

    // 5. Extract PNR or Flight Codes
    let pnr: string | undefined;
    const pnrMatch = q.match(/\b([0-9]{10})\b/);
    if (pnrMatch && q.includes('pnr')) {
      pnr = pnrMatch[1];
      keywords.push(pnr);
    }

    let travelType: 'flight' | 'train' | 'bus' | 'hotel' | 'general' | undefined;
    if (q.includes('flight') || q.includes('boarding') || q.includes('airline')) travelType = 'flight';
    else if (q.includes('train') || q.includes('railway') || q.includes('irctc') || q.includes('pnr')) travelType = 'train';
    else if (q.includes('bus')) travelType = 'bus';
    else if (q.includes('hotel') || q.includes('stay')) travelType = 'hotel';
    else if (q.includes('ticket') || q.includes('travel') || q.includes('trip')) travelType = 'general';

    // 6. Relative Date Ranges
    let relativeDate: 'today' | 'yesterday' | 'this_week' | 'this_month' | undefined;
    if (q.includes('today')) relativeDate = 'today';
    else if (q.includes('yesterday')) relativeDate = 'yesterday';
    else if (q.includes('this week')) relativeDate = 'this_week';
    else if (q.includes('this month') || q.includes('past month') || q.includes('recent')) relativeDate = 'this_month';

    const dateRange = relativeDate ? { relative: relativeDate } : undefined;

    // 7. Determine Primary Domain & Intent Type
    // Document intent
    if (matchedDoc || q.includes('document') || q.includes('id card') || q.includes('certificate')) {
      return {
        domain: 'documents',
        intentType: 'document_query',
        documentType: matchedDoc || 'document',
        dateRange,
        keywords: Array.from(new Set([...keywords, matchedDoc || 'document'])),
        rawQuery: query,
      };
    }

    // Travel intent
    if (travelType || pnr || q.includes('booking') || merchantDomain === 'travel') {
      return {
        domain: 'travel',
        intentType: pnr ? 'pnr_query' : 'ticket_query',
        merchant: matchedMerchant,
        travelType: travelType || 'general',
        pnr,
        dateRange,
        keywords: Array.from(new Set([...keywords, 'travel', travelType || 'ticket'])),
        rawQuery: query,
      };
    }

    // Food delivery intent
    if (
      merchantDomain === 'food_delivery' ||
      q.includes('food') ||
      q.includes('swiggy') ||
      q.includes('zomato') ||
      q.includes('restaurant') ||
      q.includes('meal')
    ) {
      return {
        domain: 'food_delivery',
        intentType: matchedMerchant ? 'merchant_query' : 'general_search',
        merchant: matchedMerchant,
        minAmount,
        maxAmount,
        dateRange,
        keywords: Array.from(new Set([...keywords, 'food_delivery', matchedMerchant?.toLowerCase() || 'food'])),
        rawQuery: query,
      };
    }

    // Chat screenshots intent
    if (
      merchantDomain === 'chats' ||
      q.includes('chat') ||
      q.includes('whatsapp') ||
      q.includes('telegram') ||
      q.includes('message') ||
      q.includes('conversation')
    ) {
      return {
        domain: 'chats',
        intentType: 'chat_query',
        appFilter: matchedMerchant ? matchedMerchant.toLowerCase() : undefined,
        dateRange,
        keywords: Array.from(new Set([...keywords, 'chats'])),
        rawQuery: query,
      };
    }

    // Finance / Payment intent
    if (
      minAmount !== undefined ||
      maxAmount !== undefined ||
      merchantDomain === 'finance' ||
      q.includes('payment') ||
      q.includes('paid') ||
      q.includes('upi') ||
      q.includes('debited') ||
      q.includes('credited') ||
      q.includes('transaction') ||
      q.includes('spend') ||
      q.includes('expense')
    ) {
      return {
        domain: 'finance',
        intentType: minAmount !== undefined || maxAmount !== undefined ? 'payment_query' : 'merchant_query',
        merchant: matchedMerchant,
        minAmount,
        maxAmount,
        currency: 'INR',
        dateRange,
        keywords: Array.from(new Set([...keywords, 'finance', 'payment'])),
        rawQuery: query,
      };
    }

    // Shopping intent
    if (merchantDomain === 'shopping' || q.includes('shopping') || q.includes('order') || q.includes('purchase')) {
      return {
        domain: 'shopping',
        intentType: matchedMerchant ? 'merchant_query' : 'general_search',
        merchant: matchedMerchant,
        minAmount,
        maxAmount,
        dateRange,
        keywords: Array.from(new Set([...keywords, 'shopping'])),
        rawQuery: query,
      };
    }

    // Entertainment intent
    if (merchantDomain === 'entertainment' || q.includes('entertainment') || q.includes('movie') || q.includes('song')) {
      return {
        domain: 'entertainment',
        intentType: 'general_search',
        keywords: Array.from(new Set([...keywords, 'entertainment'])),
        rawQuery: query,
      };
    }

    // Date query intent
    if (relativeDate) {
      return {
        domain: 'general',
        intentType: 'date_query',
        dateRange: { relative: relativeDate },
        keywords: Array.from(new Set([...keywords, relativeDate])),
        rawQuery: query,
      };
    }

    // Fallback: General Search Intent
    const tokens = q
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 3);

    return {
      domain: 'general',
      intentType: 'general_search',
      merchant: matchedMerchant,
      minAmount,
      maxAmount,
      keywords: Array.from(new Set([...keywords, ...tokens])),
      rawQuery: query,
    };
  }
}
