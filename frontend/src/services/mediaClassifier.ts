export interface HeuristicClassification {
  categoryName: string;
  subcategory: string;
  folderPath: string[];
  tags: string[];
  confidence: number;
}

export class MediaClassifier {
  inferSourceApp(pathOrName: string): string | null {
    const lower = pathOrName.toLowerCase();
    if (lower.includes('whatsapp')) return 'WhatsApp';
    if (lower.includes('telegram')) return 'Telegram';
    if (lower.includes('instagram')) return 'Instagram';
    if (lower.includes('twitter') || lower.includes('x_')) return 'Twitter';
    if (lower.includes('linkedin')) return 'LinkedIn';
    if (lower.includes('slack')) return 'Slack';
    if (lower.includes('discord')) return 'Discord';
    if (lower.includes('amazon')) return 'Amazon';
    if (lower.includes('flipkart')) return 'Flipkart';
    if (lower.includes('chrome') || lower.includes('browser')) return 'Browser';
    return null;
  }

  classifyMediaItem({
    fileName = '',
    filePath = '',
    ocrText = '',
    sourceApp,
    visionDescription = '',
  }: {
    fileName?: string;
    filePath?: string;
    ocrText?: string;
    sourceApp?: string;
    visionDescription?: string;
  }): HeuristicClassification {
    const rawText = ocrText.trim();
    const text = rawText.toLowerCase();
    const name = fileName.toLowerCase();
    const path = filePath.toLowerCase();
    const app = (sourceApp || this.inferSourceApp(path || name) || '').toLowerCase();
    const desc = visionDescription.toLowerCase();

    // 1. Projects / Payroll / Work
    const isPayroll =
      text.includes('payroll') ||
      text.includes('payslip') ||
      text.includes('salary slip') ||
      text.includes('net salary') ||
      text.includes('earnings & deductions') ||
      text.includes('pf contribution') ||
      text.includes('basic pay') ||
      name.includes('payroll') ||
      name.includes('salary');

    const isProject =
      text.includes('project') ||
      text.includes('sprint') ||
      text.includes('jira') ||
      text.includes('trello') ||
      text.includes('asana') ||
      text.includes('deliverable') ||
      app.includes('jira') ||
      app.includes('asana') ||
      app.includes('slack');

    if (isPayroll || isProject) {
      const tags = ['work', 'project'];
      let entity = '';

      const orgMatch = rawText.match(
        /\b(NHDC|TCS|INFOSYS|WIPRO|HCL|GOOGLE|META|AMAZON|MICROSOFT|RELIANCE|TATA|[A-Z]{3,8})\b/
      );
      if (orgMatch && !['THE', 'AND', 'FOR'].includes(orgMatch[0])) {
        entity = orgMatch[0];
      } else if (name.includes('nhdc') || text.includes('nhdc')) {
        entity = 'NHDC';
      }

      if (isPayroll) {
        tags.push('payroll', 'salary');
        const folderHierarchy = entity
          ? ['Projects', entity, 'Payroll']
          : ['Projects', 'Payroll'];
        return {
          categoryName: 'Projects',
          subcategory: 'Payroll',
          folderPath: folderHierarchy,
          tags,
          confidence: 0.95,
        };
      } else {
        const sub = entity || 'General';
        const folderHierarchy = entity ? ['Projects', entity] : ['Projects', 'Tasks'];
        return {
          categoryName: 'Projects',
          subcategory: sub,
          folderPath: folderHierarchy,
          tags,
          confidence: 0.9,
        };
      }
    }

    // 2. Shopping & Wishlist
    const isShopping =
      app.includes('amazon') ||
      app.includes('flipkart') ||
      app.includes('myntra') ||
      text.includes('add to cart') ||
      text.includes('buy now') ||
      text.includes('wishlist') ||
      text.includes('delivery address') ||
      text.includes('order summary') ||
      desc.includes('shopping');

    if (isShopping) {
      let subcategory = 'General';
      const tags = ['shopping'];

      if (
        text.includes('shoe') ||
        text.includes('sneaker') ||
        text.includes('nike') ||
        text.includes('adidas') ||
        text.includes('puma')
      ) {
        subcategory = 'Shoes';
        tags.push('footwear', 'fashion');
      } else if (
        text.includes('phone') ||
        text.includes('laptop') ||
        text.includes('headphone') ||
        text.includes('gadget')
      ) {
        subcategory = 'Electronics';
        tags.push('tech', 'gadgets');
      } else if (
        text.includes('shirt') ||
        text.includes('t-shirt') ||
        text.includes('dress') ||
        text.includes('jacket')
      ) {
        subcategory = 'Clothing';
        tags.push('apparel', 'fashion');
      }

      return {
        categoryName: 'Shopping & Wishlist',
        subcategory,
        folderPath: ['Shopping', subcategory],
        tags,
        confidence: 0.92,
      };
    }

    // 3. Receipts & Invoices
    const isReceipt =
      text.includes('invoice') ||
      text.includes('receipt') ||
      text.includes('tax invoice') ||
      text.includes('total amount') ||
      text.includes('order id') ||
      text.includes('billing address') ||
      text.includes('payment received');

    if (isReceipt) {
      return {
        categoryName: 'Receipts & Invoices',
        subcategory: 'Invoices',
        folderPath: ['Receipts & Invoices', 'Invoices'],
        tags: ['receipt', 'tax', 'finance'],
        confidence: 0.94,
      };
    }

    // 4. Finance & Banking
    const isFinance =
      text.includes('upi') ||
      text.includes('gpay') ||
      text.includes('phonepe') ||
      text.includes('paytm') ||
      text.includes('bank') ||
      text.includes('statement') ||
      text.includes('account number') ||
      text.includes('debited') ||
      text.includes('credited');

    if (isFinance) {
      return {
        categoryName: 'Finance & Banking',
        subcategory: 'Transactions',
        folderPath: ['Finance & Banking', 'Transactions'],
        tags: ['finance', 'payment', 'banking'],
        confidence: 0.91,
      };
    }

    // 5. Code & Tech
    const isCode =
      text.includes('const ') ||
      text.includes('function ') ||
      text.includes('import ') ||
      text.includes('class ') ||
      text.includes('return ') ||
      text.includes('exception') ||
      text.includes('stacktrace') ||
      text.includes('npm ') ||
      text.includes('git ');

    if (isCode) {
      return {
        categoryName: 'Code & Tech',
        subcategory: 'Snippets',
        folderPath: ['Code & Tech', 'Snippets'],
        tags: ['code', 'developer', 'programming'],
        confidence: 0.9,
      };
    }

    // 6. Social & Chat
    const isSocial =
      app.includes('whatsapp') ||
      app.includes('telegram') ||
      app.includes('instagram') ||
      app.includes('discord') ||
      app.includes('twitter');

    if (isSocial) {
      const sub = app.charAt(0).toUpperCase() + app.slice(1);
      return {
        categoryName: 'Social & Chat',
        subcategory: sub,
        folderPath: ['Social & Chat', sub],
        tags: ['social', 'chat', app],
        confidence: 0.88,
      };
    }

    // 7. Documents & IDs
    const isDoc =
      text.includes('passport') ||
      text.includes('driving licence') ||
      text.includes('identity card') ||
      text.includes('aadhaar') ||
      text.includes('certificate');

    if (isDoc) {
      return {
        categoryName: 'Documents & IDs',
        subcategory: 'Identity',
        folderPath: ['Documents & IDs', 'Identity'],
        tags: ['document', 'id', 'personal'],
        confidence: 0.93,
      };
    }

    // 8. Travel & Tickets
    const isTravel =
      text.includes('boarding pass') ||
      text.includes('flight') ||
      text.includes('train ticket') ||
      text.includes('booking reference') ||
      text.includes('pnr') ||
      text.includes('gate');

    if (isTravel) {
      return {
        categoryName: 'Travel & Tickets',
        subcategory: 'Bookings',
        folderPath: ['Travel & Tickets', 'Bookings'],
        tags: ['travel', 'tickets', 'transit'],
        confidence: 0.92,
      };
    }

    // Fallback: Unsorted
    return {
      categoryName: 'Unsorted',
      subcategory: 'General',
      folderPath: ['Unsorted'],
      tags: ['snapshot'],
      confidence: 0.5,
    };
  }
}

export const mediaClassifier = new MediaClassifier();
