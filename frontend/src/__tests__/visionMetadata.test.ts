jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    select: (obj: any) => obj.android ?? obj.default,
  },
  Dimensions: {
    get: jest.fn(() => ({ width: 400, height: 800 })),
  },
  NativeModules: {},
}));

jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => ({
    getString: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    clearAll: jest.fn(),
  })),
}));

import { extractMetadataFromVisionResponse } from '../services/visionAIService';

describe('Vision AI Metadata Normalization Contract (Phase 13)', () => {
  it('safely handles empty or undefined raw input', () => {
    const result = extractMetadataFromVisionResponse(null);
    expect(result).toBeDefined();
    expect(result.category).toBe('Other');
    expect(result.folder_hierarchy).toEqual(['Other']);
    expect(result.tags).toContain('screenshot');
    expect(result.ocr_text).toBe('');
    expect(result.confidence).toBe(0.95);
  });

  it('normalizes a full UPI payment response from Vision AI', () => {
    const raw = {
      title: 'PhonePe Payment',
      summary: 'Paid ₹450 to Starbucks',
      category: 'Finance',
      screen_type: 'payment_success',
      folder_hierarchy: ['Finance', 'Starbucks'],
      merchant: 'Starbucks',
      amount: 450,
      currency: 'INR',
      payment_method: 'UPI',
      date: '2026-09-22',
      tags: ['starbucks', 'coffee', 'upi'],
      ocr_text: 'Paid to Starbucks Coffee ₹450.00 UPI Ref 12345678',
      confidence: 0.98,
      bullet_points: ['Amount: ₹450', 'Method: UPI'],
      entities: {
        merchant: 'Starbucks',
        amount: 450,
        currency: 'INR',
        paymentMethod: 'UPI',
        upiId: 'starbucks@hdfcbank',
      },
    };

    const norm = extractMetadataFromVisionResponse(raw);

    expect(norm.category).toBe('Finance');
    expect(norm.screen_type).toBe('payment_success');
    expect(norm.merchant).toBe('Starbucks');
    expect(norm.amount).toBe(450);
    expect(norm.currency).toBe('INR');
    expect(norm.payment_method).toBe('UPI');
    expect(norm.folder_hierarchy).toEqual(['Finance', 'Starbucks']);
    expect(norm.tags).toContain('finance');
    expect(norm.tags).toContain('starbucks');
    expect(norm.ocr_text).toBe('Paid to Starbucks Coffee ₹450.00 UPI Ref 12345678');
    expect(norm.confidence).toBe(0.98);
  });

  it('converts percentage confidence (e.g. 96) to decimal (0.96)', () => {
    const raw = {
      summary: 'Flight ticket confirmed',
      category: 'travel',
      confidence: 96,
    };

    const norm = extractMetadataFromVisionResponse(raw);
    expect(norm.confidence).toBe(0.96);
    expect(norm.category).toBe('Travel');
  });

  it('auto-synthesizes folder hierarchy from category and merchant when omitted', () => {
    const raw = {
      category: 'Shopping',
      merchant: 'Amazon',
      summary: 'Order delivered',
    };

    const norm = extractMetadataFromVisionResponse(raw);
    expect(norm.folder_hierarchy).toEqual(['Shopping', 'Amazon']);
  });

  it('synthesizes ocr_text from summary, merchant, and amount if ocr_text is absent', () => {
    const raw = {
      title: 'Order Receipt',
      summary: 'Order placed on Swiggy',
      merchant: 'Swiggy',
      amount: 320,
      currency: 'INR',
      category: 'Food Delivery',
    };

    const norm = extractMetadataFromVisionResponse(raw);
    expect(norm.ocr_text).toContain('Order Receipt');
    expect(norm.ocr_text).toContain('Order placed on Swiggy');
    expect(norm.ocr_text).toContain('Merchant: Swiggy');
    expect(norm.ocr_text).toContain('Amount: INR 320');
  });

  it('unwraps nested extracted_data schemas from backend gateway', () => {
    const raw = {
      extracted_data: {
        title: 'Boarding Pass',
        summary: 'IndiGo flight 6E-204 to Mumbai',
        category: 'Travel',
        screen_type: 'boarding_pass',
        folder_hierarchy: ['Travel', 'IndiGo'],
        merchant: 'IndiGo',
        tags: ['indigo', 'flight', 'mumbai'],
        ocr_text: 'IndiGo 6E-204 DEL -> BOM Seat 14A',
        confidence: 0.94,
      },
    };

    const norm = extractMetadataFromVisionResponse(raw);
    expect(norm.category).toBe('Travel');
    expect(norm.merchant).toBe('IndiGo');
    expect(norm.folder_hierarchy).toEqual(['Travel', 'IndiGo']);
    expect(norm.ocr_text).toBe('IndiGo 6E-204 DEL -> BOM Seat 14A');
    expect(norm.confidence).toBe(0.94);
  });
});
