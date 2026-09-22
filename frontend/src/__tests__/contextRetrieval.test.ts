jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');

jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    select: (obj: any) => obj.android ?? obj.default,
  },
  StyleSheet: {
    create: (styles: any) => styles,
    hairlineWidth: 1,
    absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  },
  Dimensions: {
    get: jest.fn(() => ({ width: 400, height: 800 })),
  },
  View: 'View',
  Text: 'Text',
  TextInput: 'TextInput',
  Modal: 'Modal',
  ScrollView: 'ScrollView',
  FlatList: 'FlatList',
  SectionList: 'SectionList',
  TouchableOpacity: 'TouchableOpacity',
  ActivityIndicator: 'ActivityIndicator',
  RefreshControl: 'RefreshControl',
  Alert: { alert: jest.fn() },
}));

/**
 * contextRetrieval.test.ts
 * Unit tests for Hybrid Context Retrieval Engine (Sprint P3-B).
 */

import { contextRetrievalService } from '../services/contextChat/ContextRetrievalService';
import { useScreenshotStore } from '../store/screenshot.store';
import { ScreenshotModel } from '../models';

describe('Sprint P3-B — ContextRetrievalService Hybrid Test Suite', () => {
  const mockScreenshots: ScreenshotModel[] = [
    {
      id: 'sc_swiggy_1',
      deviceAssetId: 'asset_1',
      width: 1080,
      height: 1920,
      fileSize: 1024,
      tags: [],
      filePath: '/storage/screenshots/swiggy_dinner.png',
      localPath: '/storage/screenshots/swiggy_dinner.png',
      fileName: 'swiggy_dinner.png',
      createdAt: '2026-09-22T19:30:00Z',
      categoryId: 'food_delivery',
      categoryName: 'Food Delivery',
      subcategory: 'Swiggy',
      confidence: 0.95,
      ocrText: 'Swiggy Delivery Order Total ₹450 Paid via UPI to Bundl Technologies',
      keywords: ['swiggy', 'food', 'dinner', 'order', 'upi'],
      entities: { merchant: 'Swiggy', amount: '450' } as any,
      isFavorite: false,
      isReviewed: true,
      isSynced: true,
      ocrStatus: 'completed',
    },
    {
      id: 'sc_amazon_1',
      deviceAssetId: 'asset_2',
      width: 1080,
      height: 1920,
      fileSize: 1024,
      tags: [],
      filePath: '/storage/screenshots/amazon_headphones.png',
      localPath: '/storage/screenshots/amazon_headphones.png',
      fileName: 'amazon_headphones.png',
      createdAt: '2026-09-22T14:15:00Z',
      categoryId: 'shopping',
      categoryName: 'Shopping',
      subcategory: 'Amazon',
      confidence: 0.98,
      ocrText: 'Amazon.in Tax Invoice Sony WH-1000XM5 Total ₹24,990 Order Placed',
      keywords: ['amazon', 'shopping', 'headphones', 'invoice', 'electronics'],
      entities: { merchant: 'Amazon', amount: '24990' } as any,
      isFavorite: true,
      isReviewed: true,
      isSynced: true,
      ocrStatus: 'completed',
    },
    {
      id: 'sc_gpay_1',
      deviceAssetId: 'asset_3',
      width: 1080,
      height: 1920,
      fileSize: 1024,
      tags: [],
      filePath: '/storage/screenshots/gpay_rent.png',
      localPath: '/storage/screenshots/gpay_rent.png',
      fileName: 'gpay_rent.png',
      createdAt: '2026-09-21T10:00:00Z',
      categoryId: 'finance',
      categoryName: 'Finance',
      subcategory: 'Google Pay',
      confidence: 0.99,
      ocrText: 'Google Pay Paid to Landlord ₹18,000 UPI Transaction ID 32891823',
      keywords: ['google pay', 'gpay', 'rent', 'payment', 'upi'],
      entities: { merchant: 'Google Pay', amount: '18000' } as any,
      isFavorite: false,
      isReviewed: true,
      isSynced: true,
      ocrStatus: 'completed',
    },
    {
      id: 'sc_delhi_flight',
      deviceAssetId: 'asset_4',
      width: 1080,
      height: 1920,
      fileSize: 1024,
      tags: [],
      filePath: '/storage/screenshots/delhi_flight.png',
      localPath: '/storage/screenshots/delhi_flight.png',
      fileName: 'delhi_flight.png',
      createdAt: '2026-09-20T08:30:00Z',
      categoryId: 'travel',
      categoryName: 'Travel',
      subcategory: 'IndiGo',
      confidence: 0.97,
      ocrText: 'IndiGo Boarding Pass Flight 6E 204 BOM to DEL Delhi PNR W9KZ7Q',
      keywords: ['indigo', 'flight', 'delhi', 'boarding pass', 'pnr_w9kz7q', '6e204'],
      entities: { merchant: 'IndiGo', origin: 'BOM', destination: 'DEL' } as any,
      isFavorite: false,
      isReviewed: true,
      isSynced: true,
      ocrStatus: 'completed',
    },
  ];

  beforeEach(() => {
    contextRetrievalService.clearCache();
    useScreenshotStore.setState({ screenshots: mockScreenshots });
  });

  it('retrieves and ranks hybrid context matching query intent', async () => {
    const context = await contextRetrievalService.retrieveHybridContext('Find my Amazon headphone invoice');

    expect(context).toBeDefined();
    expect(context.query).toBe('Find my Amazon headphone invoice');
    expect(context.screenshots.length).toBeGreaterThan(0);

    const topScreenshot = context.screenshots[0];
    expect(topScreenshot.screenshot.fileName).toBe('amazon_headphones.png');
    expect(topScreenshot.merchants).toContain('Amazon');
    expect(topScreenshot.score).toBeGreaterThan(50);
  });

  it('caps hybrid results to maximum allowable context limits', async () => {
    const context = await contextRetrievalService.retrieveHybridContext('Show all screenshots');

    expect(context.screenshots.length).toBeLessThanOrEqual(10);
    expect(context.timelineEvents.length).toBeLessThanOrEqual(5);
    expect(context.digestSummaries.length).toBeLessThanOrEqual(3);
  });

  it('uses 30-second TTL performance cache for repeated queries', async () => {
    const res1 = await contextRetrievalService.retrieveHybridContext('How much did I spend on Swiggy?');
    const res2 = await contextRetrievalService.retrieveHybridContext('How much did I spend on Swiggy?');

    // Identical cached object reference
    expect(res1).toBe(res2);

    // Cache clearing forces recalculation
    contextRetrievalService.clearCache();
    const res3 = await contextRetrievalService.retrieveHybridContext('How much did I spend on Swiggy?');
    expect(res3).not.toBe(res1);
    expect(res3.query).toBe(res1.query);
  });

  it('filters finance queries by amount threshold correctly', async () => {
    const context = await contextRetrievalService.retrieveHybridContext('Show payments above ₹10000');
    expect(context.screenshots.length).toBeGreaterThan(0);

    // Should include Google Pay ₹18,000 and Amazon ₹24,990, but exclude Swiggy ₹450
    const fileNames = context.screenshots.map((s) => s.screenshot.fileName);
    expect(fileNames).toContain('gpay_rent.png');
    expect(fileNames).not.toContain('swiggy_dinner.png');
  });

  it('retrieves travel tickets by destination or PNR keywords', async () => {
    const context = await contextRetrievalService.retrieveHybridContext('When did I book my Delhi flight?');
    expect(context.screenshots.length).toBeGreaterThan(0);

    const top = context.screenshots[0];
    expect(top.screenshot.fileName).toBe('delhi_flight.png');
    expect(top.ocrText).toContain('Delhi');
  });
});
