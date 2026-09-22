import { folderContextExportService } from '../services/folderContextExportService';
import { FolderContextModel, createEmptyFolderContext } from '../models/folderContext.model';
import { ScreenshotModel } from '../models/screenshot.model';
import { Share } from 'react-native';

jest.mock('react-native', () => ({
  Share: {
    share: jest.fn().mockResolvedValue({ action: 'sharedAction' }),
  },
  StyleSheet: {
    create: (styles: any) => styles,
  },
  Platform: {
    OS: 'android',
    select: (obj: any) => obj.android,
  },
}));

describe('FolderContextExportService (Sprint P1-6)', () => {
  const mockContext: FolderContextModel = {
    categoryId: 'cat-finance-01',
    categoryName: 'Finance & Invoices',
    summary: 'Tax invoices and recurring cloud subscription payments for Q3.',
    keywords: ['AWS Cloud', 'Stripe Payments', 'Tax Invoice 2024'],
    confidence: 0.94,
    screenshotCount: 3,
    lastUpdatedAt: '2024-03-15T14:30:00.000Z',
    version: 1,
    tasks: [
      { id: 't1', title: 'Submit GST report to accountant', isCompleted: false, dueDate: '2024-03-25' },
      { id: 't2', title: 'Reconcile AWS invoice with bank statement', isCompleted: true },
    ],
    entities: [
      { name: 'Amazon Web Services', type: 'organization', count: 4 },
      { name: '$499.00', type: 'amount', count: 2 },
    ],
    structuredEntities: {
      organizations: ['Amazon Web Services', 'Stripe Inc'],
      payments: ['$499.00', '₹38,500.00'],
      shopping: ['Server Rack 42U'],
      documents: ['INV-2024-8841', 'GST-99201'],
      people: ['Satya Nadella', 'Accountant Sharma'],
      urls: ['https://aws.amazon.com/billing', 'https://dashboard.stripe.com'],
      dates: ['2024-03-15'],
      tasks: ['Submit GST'],
      amounts: ['$499.00'],
    },
    people: ['Satya Nadella'],
    links: ['https://aws.amazon.com'],
    dates: [{ event: 'Payment Due', date: '2024-03-25' }],
    apps: ['Amazon AWS', 'Gmail'],
    topics: ['Cloud', 'Finance'],
    timeline: [
      {
        screenshotId: 'sc-01',
        title: 'AWS Cloud Invoice',
        description: 'Monthly compute and storage bill',
        capturedAt: '2024-03-15T10:00:00.000Z',
      },
      {
        screenshotId: 'sc-02',
        title: 'GST Challan Confirmation',
        description: 'Tax payment reference confirmation',
        capturedAt: '2024-03-14T09:00:00.000Z',
      },
    ],
  };

  const mockScreenshots: ScreenshotModel[] = [
    {
      id: 'sc-01',
      deviceAssetId: 'asset-01',
      filePath: 'file:///storage/emulated/0/Pictures/Screenshots/aws_bill.png',
      fileName: 'aws_bill.png',
      width: 1080,
      height: 2400,
      fileSize: 1024,
      createdAt: '2024-03-15T10:00:00.000Z',
      categoryId: 'cat-finance-01',
      categoryName: 'Finance & Invoices',
      subcategory: 'Invoices',
      confidence: 0.95,
      isAutoCategorized: true,
      isFavorite: false,
      isReviewed: true,
      isSynced: true,
      ocrStatus: 'completed',
      ocrText: 'Amazon Web Services Invoice Total: $499.00 Billing Period: Feb 2024',
      tags: [],
    },
    {
      id: 'sc-02',
      deviceAssetId: 'asset-02',
      filePath: 'file:///storage/emulated/0/Pictures/Screenshots/gst_receipt.png',
      fileName: 'gst_receipt.png',
      width: 1080,
      height: 2400,
      fileSize: 2048,
      createdAt: '2024-03-14T09:00:00.000Z',
      categoryId: 'cat-finance-01',
      categoryName: 'Finance & Invoices',
      subcategory: 'Taxes',
      confidence: 0.92,
      isAutoCategorized: true,
      isFavorite: false,
      isReviewed: true,
      isSynced: true,
      ocrStatus: 'completed',
      ocrText: 'Government of India GST Payment Receipt Challan Number 99201 Amount INR 38,500',
      tags: [],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateMarkdown', () => {
    it('generates rich GitHub-flavored markdown with full context and metadata', () => {
      const md = folderContextExportService.generateMarkdown(
        mockContext,
        mockContext.categoryName,
        mockScreenshots
      );

      expect(md).toContain('# Finance & Invoices — Living Folder Context');
      expect(md).toContain('94% AI Match');
      expect(md).toContain('Tax invoices and recurring cloud subscription');
      expect(md).toContain('## 💡 Key Insights & Topics');
      expect(md).toContain('AWS Cloud');
      expect(md).toContain('## 📦 Extracted Entities');
      expect(md).toContain('Amazon Web Services');
      expect(md).toContain('`$499.00`');
      expect(md).toContain('INV-2024-8841');
      expect(md).toContain('## ✅ Action Items');
      expect(md).toContain('- [ ] Submit GST report to accountant');
      expect(md).toContain('- [x] Reconcile AWS invoice with bank statement');
      expect(md).toContain('## ⏳ Chronological Timeline');
      expect(md).toContain('AWS Cloud Invoice');
      expect(md).toContain('## 📸 Source Screenshots (2)');
      expect(md).toContain('aws_bill.png');
      expect(md).toContain('gst_receipt.png');
    });

    it('handles empty folder context gracefully', () => {
      const emptyContext = createEmptyFolderContext('empty-id', 'Unsorted');
      const md = folderContextExportService.generateMarkdown(emptyContext, 'Unsorted', []);

      expect(md).toContain('# Unsorted — Living Folder Context');
      expect(md).toContain('0% AI Match');
      expect(md).toContain('Exported securely from ContextVault');
    });
  });

  describe('generatePlainText', () => {
    it('generates structured plain text with clean ASCII formatting and dividers', () => {
      const txt = folderContextExportService.generatePlainText(
        mockContext,
        mockContext.categoryName,
        mockScreenshots
      );

      expect(txt).toContain('CONTEXTVAULT FOLDER INTELLIGENCE REPORT');
      expect(txt).toContain('Category:   FINANCE & INVOICES');
      expect(txt).toContain('Confidence: 94% Match');
      expect(txt).toContain('1. EXECUTIVE SUMMARY');
      expect(txt).toContain('2. KEY TOPICS & INSIGHTS');
      expect(txt).toContain('3. EXTRACTED ENTITIES');
      expect(txt).toContain('4. ACTION ITEMS');
      expect(txt).toContain('[ ] Submit GST report to accountant');
      expect(txt).toContain('[X] Reconcile AWS invoice with bank statement');
      expect(txt).toContain('5. CHRONOLOGICAL TIMELINE');
      expect(txt).toContain('6. SOURCE SCREENSHOTS (2)');
      expect(txt).toContain('aws_bill.png');
    });
  });

  describe('generatePdf', () => {
    it('generates standard PDF 1.4 specification structure with xref and trailer', () => {
      const pdf = folderContextExportService.generatePdf(
        mockContext,
        mockContext.categoryName,
        mockScreenshots
      );

      expect(pdf.raw).toBeDefined();
      expect(pdf.base64).toBeDefined();
      expect(pdf.dataUri).toBeDefined();

      // Check PDF header
      expect(pdf.raw.startsWith('%PDF-1.4')).toBe(true);

      // Check PDF objects
      expect(pdf.raw).toContain('/Type /Catalog');
      expect(pdf.raw).toContain('/Type /Pages');
      expect(pdf.raw).toContain('/Type /Font');
      expect(pdf.raw).toContain('/BaseFont /Courier');
      expect(pdf.raw).toContain('/BaseFont /Courier-Bold');

      // Check cross-reference table and trailer
      expect(pdf.raw).toContain('xref');
      expect(pdf.raw).toContain('trailer');
      expect(pdf.raw).toContain('/Root 1 0 R');
      expect(pdf.raw).toContain('startxref');
      expect(pdf.raw.endsWith('%%EOF\n')).toBe(true);

      // Check dataUri prefix
      expect(pdf.dataUri.startsWith('data:application/pdf;base64,')).toBe(true);
    });

    it('generates multi-page PDF when line content is lengthy', () => {
      // Create context with extensive text
      const largeContext: FolderContextModel = {
        ...mockContext,
        summary: 'Paragraph line.\n'.repeat(120),
      };

      const pdf = folderContextExportService.generatePdf(largeContext, 'Large Folder');
      expect(pdf.raw).toContain('/Count');
      // Should have more than 1 page
      expect(pdf.raw).toContain('Page 1 of');
      expect(pdf.raw.endsWith('%%EOF\n')).toBe(true);
    });
  });

  describe('shareExport', () => {
    it('triggers Share.share with markdown format', async () => {
      const result = await folderContextExportService.shareExport(
        'markdown',
        mockContext,
        mockContext.categoryName,
        mockScreenshots
      );

      expect(result.format).toBe('markdown');
      expect(result.title).toBe('Finance___Invoices_Context.md');
      expect(Share.share).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Finance___Invoices_Context.md',
          message: expect.stringContaining('# Finance & Invoices'),
        })
      );
    });

    it('triggers Share.share with text format', async () => {
      const result = await folderContextExportService.shareExport(
        'text',
        mockContext,
        mockContext.categoryName,
        mockScreenshots
      );

      expect(result.format).toBe('text');
      expect(result.title).toBe('Finance___Invoices_Context.txt');
      expect(Share.share).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Finance___Invoices_Context.txt',
          message: expect.stringContaining('CONTEXTVAULT FOLDER INTELLIGENCE REPORT'),
        })
      );
    });

    it('triggers Share.share with PDF format and data URI', async () => {
      const result = await folderContextExportService.shareExport(
        'pdf',
        mockContext,
        mockContext.categoryName,
        mockScreenshots
      );

      expect(result.format).toBe('pdf');
      expect(result.title).toBe('Finance___Invoices_Context.pdf');
      expect(result.dataUri).toBeDefined();
      expect(Share.share).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Finance___Invoices_Context.pdf',
          url: expect.stringContaining('data:application/pdf;base64,'),
        })
      );
    });
  });
});
