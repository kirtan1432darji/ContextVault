import axios from 'axios';
import { openAIVisionService } from '../services/OpenAIVisionService';
import { mediaObserverService } from '../services/backgroundDetection/mediaObserver';
import { visionAIService } from '../services/visionAIService';
import { visionRepository } from '../database/repositories/VisionRepository';
import { databaseService } from '../database';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('../database/repositories/VisionRepository', () => ({
  visionRepository: {
    saveStructuredResult: jest.fn().mockResolvedValue(undefined),
    getByFileHash: jest.fn().mockResolvedValue(null),
    getVisionResult: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('../database', () => ({
  databaseService: {
    executeCommand: jest.fn().mockResolvedValue({ rowsAffected: 1 }),
  },
}));

describe('OpenAIVisionService', () => {
  const mockApiKey = 'sk-proj-test-key-1234567890abcdef';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('detects API key availability', () => {
    expect(openAIVisionService.isAvailable(mockApiKey)).toBe(true);
    expect(openAIVisionService.isAvailable('')).toBe(false);
  });

  it('analyzes screenshot and classifies into Finance category', async () => {
    jest.spyOn(mediaObserverService, 'getBase64Image').mockResolvedValue('mock_base64_string');

    mockedAxios.post.mockResolvedValueOnce({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                category: 'Finance',
                subcategory: 'PhonePe',
                title: 'PhonePe Payment',
                summary: 'Paid ₹1,250 to Star Supermarket via PhonePe UPI',
                confidence: 0.98,
                merchant: 'Star Supermarket',
                amount: 1250,
                currency: 'INR',
                date: '2026-09-23',
                entities: {
                  merchant: 'Star Supermarket',
                  amount: 1250,
                  currency: 'INR',
                  transactionId: 'T2609231250',
                },
                tags: ['phonepe', 'upi', 'supermarket', 'payment'],
                ocr_text: 'PhonePe Transaction Successful Paid to Star Supermarket ₹1,250',
                bullet_points: ['Amount: ₹1,250', 'Merchant: Star Supermarket'],
              }),
            },
          },
        ],
      },
    });

    const result = await openAIVisionService.analyzeScreenshot({
      screenshotId: 'sc_openai_01',
      filePath: '/storage/emulated/0/Pictures/Screenshots/PhonePe_1.png',
      fileName: 'PhonePe_1.png',
      options: { apiKey: mockApiKey },
    });

    expect(result.isSuccess).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.category).toBe('Finance');
    expect(result.data?.merchant).toBe('Star Supermarket');
    expect(result.data?.amount).toBe(1250);
    expect(result.data?.tags).toContain('phonepe');
    expect(result.data?.ocr_text).toContain('Star Supermarket');

    // Verify OpenAI API call parameters
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({
            role: 'user',
            content: expect.arrayContaining([
              expect.objectContaining({ type: 'text' }),
              expect.objectContaining({
                type: 'image_url',
                image_url: { url: 'data:image/jpeg;base64,mock_base64_string' },
              }),
            ]),
          }),
        ]),
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${mockApiKey}`,
        }),
      })
    );
  });

  it('classifies Shopping screenshot from Amazon accurately', async () => {
    jest.spyOn(mediaObserverService, 'getBase64Image').mockResolvedValue('mock_base64_amazon');

    mockedAxios.post.mockResolvedValueOnce({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                category: 'Shopping',
                subcategory: 'Amazon',
                title: 'Amazon Order Confirmation',
                summary: 'Order for Logitech MX Master 3S Mouse worth ₹7,499 on Amazon',
                confidence: 0.96,
                merchant: 'Amazon',
                amount: 7499,
                currency: 'INR',
                date: '2026-09-23',
                entities: {
                  merchant: 'Amazon',
                  amount: 7499,
                  orderId: '403-1234567',
                },
                tags: ['amazon', 'shopping', 'mouse', 'logitech'],
                ocr_text: 'Amazon.in Order Confirmed Logitech MX Master 3S ₹7,499',
                bullet_points: ['Item: Logitech Mouse', 'Total: ₹7,499'],
              }),
            },
          },
        ],
      },
    });

    const result = await openAIVisionService.analyzeScreenshot({
      screenshotId: 'sc_openai_02',
      filePath: '/storage/emulated/0/Pictures/Screenshots/Amazon_Order.png',
      fileName: 'Amazon_Order.png',
      options: { apiKey: mockApiKey },
    });

    expect(result.isSuccess).toBe(true);
    expect(result.data?.category).toBe('Shopping');
    expect(result.data?.merchant).toBe('Amazon');
    expect(result.data?.amount).toBe(7499);
  });

  it('integrates seamlessly with visionAIService pipeline using OpenAI', async () => {
    jest.spyOn(openAIVisionService, 'isAvailable').mockReturnValue(true);
    jest.spyOn(openAIVisionService, 'analyzeScreenshot').mockResolvedValueOnce({
      isSuccess: true,
      data: {
        title: 'WhatsApp Chat',
        summary: 'WhatsApp project chat',
        confidence: 0.95,
        screen_type: 'chats',
        category: 'Chats',
        folder_hierarchy: ['Chats', 'WhatsApp'],
        merchant: 'WhatsApp',
        entities: { platform: 'WhatsApp' },
        tags: ['whatsapp', 'chats'],
        ocr_text: 'WhatsApp ContextVault Core Team',
        bullet_points: ['Chat discussion'],
        cached: false,
        processingTimeMs: 150,
      },
      error: undefined,
    } as any);

    const result = await visionAIService.analyzeScreenshot({
      screenshotId: 'sc_flow_01',
      filePath: '/storage/emulated/0/Pictures/Screenshots/WhatsApp.png',
      fileName: 'WhatsApp.png',
      forceRefresh: true,
    });

    expect(result.isSuccess).toBe(true);
    expect(result.data?.category).toBe('Chats');
    expect(visionRepository.saveStructuredResult).toHaveBeenCalledWith(
      expect.objectContaining({
        screenshotId: 'sc_flow_01',
        modelVersion: 'openai:gpt-4o-mini',
      })
    );
  });
});
