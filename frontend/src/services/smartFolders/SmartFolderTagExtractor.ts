/**
 * SmartFolderTagExtractor.ts
 * Generates searchable, normalized tags from Vision AI metadata, entities, and OCR text regex.
 */

export interface TagExtractionInput {
  ocrText?: string;
  visionMetadata?: {
    tags?: string[];
    entities?: Record<string, any>;
    summary?: string;
    category?: string;
  };
  fileName?: string;
  extraKeywords?: string[];
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'your', 'have', 'has',
  'was', 'were', 'will', 'all', 'any', 'are', 'not', 'you', 'they', 'our',
  'been', 'there', 'their', 'what', 'when', 'where', 'which', 'who', 'how',
  'into', 'than', 'then', 'them', 'these', 'those', 'also', 'just', 'more',
  'some', 'very', 'only', 'both', 'each', 'about', 'after', 'before', 'under',
  'over', 'again', 'further', 'once', 'here', 'why', 'same', 'such', 'page',
  'view', 'click', 'open', 'please', 'thanks', 'thank',
]);

export class SmartFolderTagExtractor {
  /**
   * Extracts clean, deduplicated, lowercased tags from Vision metadata and OCR regex.
   */
  static extractTags(input: TagExtractionInput): string[] {
    const tagSet = new Set<string>();

    const addTag = (raw: string | null | undefined) => {
      if (!raw) return;
      const clean = raw.trim().toLowerCase();
      if (!clean) return;
      if (clean.length < 3) return;
      if (STOP_WORDS.has(clean)) return;
      // Filter out pure noise strings
      if (/^[^\w]+$/.test(clean)) return;

      tagSet.add(clean);
    };

    // 1. Tags from Vision AI tags array
    if (input.visionMetadata?.tags && Array.isArray(input.visionMetadata.tags)) {
      for (const t of input.visionMetadata.tags) {
        if (typeof t === 'string') {
          addTag(t);
        }
      }
    }

    // 2. Tags from Vision AI entities
    if (input.visionMetadata?.entities) {
      const ent = input.visionMetadata.entities;
      if (ent.merchant) addTag(String(ent.merchant));
      if (ent.platform) addTag(String(ent.platform));
      if (ent.application) addTag(String(ent.application));
      if (ent.paymentMethod) addTag(String(ent.paymentMethod));
      if (ent.currency) addTag(String(ent.currency));
      if (ent.documentType) addTag(String(ent.documentType));
      if (ent.orderId) addTag(String(ent.orderId));
      if (ent.pnr) addTag(String(ent.pnr));
      if (ent.flightNo) addTag(String(ent.flightNo));
      if (ent.city) addTag(String(ent.city));
      if (ent.date) addTag(String(ent.date));

      // Amount with currency
      if (ent.amount) {
        const amtStr = String(ent.amount).replace(/[^0-9.]/g, '');
        if (amtStr) {
          addTag(`₹${amtStr}`);
          addTag(`amt_${amtStr}`);
        }
      }
    }

    // 3. Regex Extraction on OCR Text
    const ocr = input.ocrText || '';
    if (ocr.length > 0) {
      // Indian Amounts: ₹550, Rs. 550, INR 550, Rs 1,200.50
      const amountRegex = /(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/gi;
      let amtMatch: RegExpExecArray | null;
      while ((amtMatch = amountRegex.exec(ocr)) !== null) {
        const rawAmt = amtMatch[1].replace(/,/g, '');
        if (rawAmt && Number(rawAmt) > 0) {
          addTag(`₹${rawAmt}`);
        }
      }

      // Dates: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
      const dateRegex = /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/g;
      let dateMatch: RegExpExecArray | null;
      while ((dateMatch = dateRegex.exec(ocr)) !== null) {
        addTag(dateMatch[1]);
      }

      // PNR numbers (10 digits, preceded or near PNR indicator)
      const pnrRegex = /(?:pnr\s*(?:no\.?|number|[:\s])\s*|\bpnr\s+)([0-9]{10})\b/gi;
      let pnrMatch: RegExpExecArray | null;
      while ((pnrMatch = pnrRegex.exec(ocr)) !== null) {
        addTag(`pnr_${pnrMatch[1]}`);
        addTag(pnrMatch[1]);
      }

      // Standalone 10-digit number if OCR contains PNR
      if (/pnr/i.test(ocr)) {
        const pnrStandalone = /\b([1-9]\d{9})\b/g;
        let stdMatch: RegExpExecArray | null;
        while ((stdMatch = pnrStandalone.exec(ocr)) !== null) {
          addTag(`pnr_${stdMatch[1]}`);
        }
      }

      // Flight numbers: AI203, 6E521, UK871, SG123, QP456, IX789
      const flightRegex = /\b(6E|AI|UK|SG|QP|IX|G8)[-\s]?(\d{3,4})\b/gi;
      let flightMatch: RegExpExecArray | null;
      while ((flightMatch = flightRegex.exec(ocr)) !== null) {
        addTag(`${flightMatch[1]}${flightMatch[2]}`.toLowerCase());
      }

      // Order IDs: e.g. OD123456789, #123456789
      const orderRegex = /(?:order\s*(?:id|no\.?|#)?\s*[:\s]*|OD)(\d{8,18})\b/gi;
      let orderMatch: RegExpExecArray | null;
      while ((orderMatch = orderRegex.exec(ocr)) !== null) {
        addTag(`order_${orderMatch[1]}`);
      }

      // UPI IDs / Handles: e.g. username@okhdfcbank, merchant@upi
      const upiRegex = /\b([a-zA-Z0-9.\-_]+@(okhdfcbank|okaxis|oksbi|okicici|upi|paytm|ybl|ibl|axl))\b/gi;
      let upiMatch: RegExpExecArray | null;
      while ((upiMatch = upiRegex.exec(ocr)) !== null) {
        addTag(upiMatch[1].toLowerCase());
      }

      // Invoice IDs: e.g. INV-2026-001, GSTIN
      const invRegex = /\b(INV[-A-Za-z0-9]{5,20})\b/gi;
      let invMatch: RegExpExecArray | null;
      while ((invMatch = invRegex.exec(ocr)) !== null) {
        addTag(invMatch[1].toLowerCase());
      }
    }

    // 4. Filename tokens
    if (input.fileName) {
      const base = input.fileName.replace(/\.[a-zA-Z0-9]+$/, '');
      const tokens = base.split(/[-_.\s]+/);
      for (const tok of tokens) {
        if (!/^\d+$/.test(tok)) {
          addTag(tok);
        }
      }
    }

    // 5. Extra keywords
    if (input.extraKeywords) {
      for (const kw of input.extraKeywords) {
        addTag(kw);
      }
    }

    return Array.from(tagSet);
  }
}
