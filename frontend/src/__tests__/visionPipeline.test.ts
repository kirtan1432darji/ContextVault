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

import axios from 'axios';
import { visionAIService } from '../services/visionAIService';
import { visionImagePreprocessor } from '../vision/VisionImagePreprocessor';
import { visionRepository } from '../database/repositories/VisionRepository';
import { databaseService } from '../database';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('../vision/VisionImagePreprocessor', () => ({
  visionImagePreprocessor: {
    preprocess: jest.fn(),
  },
}));

jest.mock('../database/repositories/VisionRepository', () => ({
  visionRepository: {
    saveStructuredResult: jest.fn(),
    getVisionResult: jest.fn(),
  },
}));

jest.mock('../database', () => ({
  databaseService: {
    executeCommand: jest.fn(),
    executeQuery: jest.fn(),
  },
}));

import { openAIVisionService } from '../services/OpenAIVisionService';

describe('Vision AI Pipeline Integration (Phase 13)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(openAIVisionService, 'isAvailable').mockReturnValue(false);
  });

  it('runs full vision analysis pipeline and updates sqlite cache and screenshots', async () => {
    // 1. Mock server online
    jest.spyOn(visionAIService, 'pingVisionServer').mockResolvedValue({
      online: true,
      latencyMs: 12,
      status: 'healthy',
      model: 'Qwen2.5-VL-3B-Instruct',
    });

    // 2. Mock image preprocessor
    (visionImagePreprocessor.preprocess as jest.Mock).mockResolvedValue({
      uri: 'file:///data/cache/preprocessed.jpg',
      width: 1024,
      height: 768,
      mimeType: 'image/jpeg',
    });

    // 3. Mock Gateway response
    mockedAxios.post.mockResolvedValue({
      data: {
        success: true,
        title: 'UPI Payment Successful',
        summary: 'Paid ₹850 to Zomato',
        category: 'Food Delivery',
        screen_type: 'food_receipt',
        folder_hierarchy: ['Food Delivery', 'Zomato'],
        merchant: 'Zomato',
        amount: 850,
        currency: 'INR',
        payment_method: 'UPI',
        date: '2026-09-22',
        tags: ['zomato', 'food', 'dinner'],
        ocr_text: 'Order from Zomato ₹850 Paid successfully via UPI',
        confidence: 0.97,
        bullet_points: ['Order total: ₹850'],
        entities: {
          merchant: 'Zomato',
          amount: 850,
          currency: 'INR',
          paymentMethod: 'UPI',
        },
      },
    });

    (visionRepository.saveStructuredResult as jest.Mock).mockResolvedValue(undefined);
    (databaseService.executeCommand as jest.Mock).mockResolvedValue({ rowsAffected: 1 });

    const result = await visionAIService.analyzeScreenshot({
      screenshotId: 'sc_test_123',
      filePath: '/storage/emulated/0/Pictures/Screenshots/Screenshot_1.png',
      fileName: 'Screenshot_1.png',
      forceRefresh: true,
    });

    expect(result.isSuccess).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.category).toBe('Food Delivery');
    expect(result.data?.merchant).toBe('Zomato');
    expect(result.data?.amount).toBe(850);
    expect(result.data?.ocr_text).toBe('Order from Zomato ₹850 Paid successfully via UPI');

    // Verify vision_cache save
    expect(visionRepository.saveStructuredResult).toHaveBeenCalledWith(
      expect.objectContaining({
        screenshotId: 'sc_test_123',
        structured: expect.objectContaining({
          category: 'Food Delivery',
          summary: 'Paid ₹850 to Zomato',
        }),
      })
    );

    // Verify screenshots table update with analysis_status = 'Completed'
    expect(databaseService.executeCommand).toHaveBeenCalledWith(
      expect.stringContaining("analysis_status = 'Completed'"),
      expect.arrayContaining(['Order from Zomato ₹850 Paid successfully via UPI', 'sc_test_123'])
    );
  });

  it('fails gracefully when vision server is offline', async () => {
    jest.spyOn(visionAIService, 'pingVisionServer').mockResolvedValue({
      online: false,
      latencyMs: 0,
      status: 'offline',
      error: 'Connection refused: 10.33.95.152:8000',
    });

    const result = await visionAIService.analyzeScreenshot({
      screenshotId: 'sc_offline',
      filePath: '/storage/emulated/0/Screenshots/offline.png',
      forceRefresh: true,
    });

    expect(result.isSuccess).toBe(false);
    if (!result.isSuccess) {
      expect(result.error).toContain('Connection refused');
      expect(result.rawError).toBe('VISION_SERVER_OFFLINE');
    }
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });
});
