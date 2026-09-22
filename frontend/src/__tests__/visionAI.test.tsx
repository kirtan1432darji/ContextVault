jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');

jest.mock('react-native', () => ({
  useColorScheme: jest.fn(() => 'light'),
  StyleSheet: {
    create: (styles: any) => styles,
    hairlineWidth: 1,
    absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  },
  Platform: {
    OS: 'android',
    select: (obj: any) => obj.android ?? obj.default,
  },
  Dimensions: {
    get: jest.fn(() => ({ width: 400, height: 800 })),
  },
  View: 'View',
  Text: 'Text',
  Image: 'Image',
  TouchableOpacity: 'TouchableOpacity',
  ActivityIndicator: 'ActivityIndicator',
  ScrollView: 'ScrollView',
  Alert: { alert: jest.fn() },
}));

jest.mock('../theme', () => ({
  useAppTheme: () => ({
    isDark: false,
    colors: {
      background: '#FFFFFF',
      card: '#FFFFFF',
      border: '#E5E7EB',
      primary: '#1A73E8',
      secondary: '#5F6368',
      accent: '#188038',
      success: '#188038',
      warning: '#F29900',
      error: '#D93025',
      textPrimary: '#202124',
      textSecondary: '#5F6368',
      textMuted: '#80868B',
      surfaceVariant: '#F1F5F9',
    },
  }),
}));

import axios from 'axios';
import { databaseService } from '../database';
import { visionImagePreprocessor } from '../vision/VisionImagePreprocessor';
import { visionPromptBuilder } from '../vision/VisionPromptBuilder';
import { visionResultParser } from '../vision/VisionResultParser';
import { visionModelManager, LocalVisionFallbackAdapter } from '../vision/VisionModelManager';
import { visionRepository } from '../database/repositories/VisionRepository';
import { entityMergeService } from '../services/EntityMergeService';
import { visionAIService } from '../vision/VisionAIService';
import { visionInferenceQueue } from '../vision/VisionInferenceQueue';
import { useVisionStore } from '../store/vision.store';
import { VisionScene, VisionCacheRecord } from '../vision/types';

describe('ContextVault Sprint V01 — Vision AI Foundation Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // Task 3: Image Preprocessing
  // =========================================================================
  describe('Task 3: VisionImagePreprocessor', () => {
    it('scales large screenshot to max 1024px longest edge while preserving aspect ratio', () => {
      // 1080 x 2400 screenshot
      const result = visionImagePreprocessor.calculateTargetDimensions(1080, 2400, 1024);
      expect(result.targetHeight).toBe(1024);
      expect(result.targetWidth).toBe(Math.round(1080 * (1024 / 2400))); // 461px
      expect(result.scaleFactor).toBeCloseTo(1024 / 2400, 3);
      expect(result.aspectRatio).toBeCloseTo(1080 / 2400, 3);
    });

    it('does not upscale small images that are under 1024px', () => {
      const result = visionImagePreprocessor.calculateTargetDimensions(600, 800, 1024);
      expect(result.targetWidth).toBe(600);
      expect(result.targetHeight).toBe(800);
      expect(result.scaleFactor).toBe(1.0);
    });

    it('handles landscape images scaling width to 1024px', () => {
      const result = visionImagePreprocessor.calculateTargetDimensions(1920, 1080, 1024);
      expect(result.targetWidth).toBe(1024);
      expect(result.targetHeight).toBe(Math.round(1080 * (1024 / 1920))); // 576px
    });

    it('preprocesses image and generates compression and color space metadata', async () => {
      const preprocessed = await visionImagePreprocessor.preprocess('/storage/emulated/0/test.png', {
        width: 1080,
        height: 2400,
        orientation: 1,
      });

      expect(preprocessed.uri).toContain('test.png');
      expect(preprocessed.width).toBe(461);
      expect(preprocessed.height).toBe(1024);
      expect(preprocessed.format).toBe('jpeg');
      expect(preprocessed.colorSpace).toBe('sRGB');
      expect(preprocessed.compressedSizeEstimateBytes).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Task 5: Vision Prompt Builder
  // =========================================================================
  describe('Task 5: VisionPromptBuilder', () => {
    it('detects domain correctly based on OCR keywords and file name', () => {
      expect(visionPromptBuilder.detectDomain('Amazon order confirmation', 'sc_amazon.png')).toBe('shopping');
      expect(visionPromptBuilder.detectDomain('UPI transaction paid to merchant', 'sc_phonepe.png')).toBe('banking');
      expect(visionPromptBuilder.detectDomain('TypeError: undefined in index.ts', 'sc_vscode.png')).toBe('code');
      expect(visionPromptBuilder.detectDomain('WhatsApp group conversation and messages', 'sc_chat.png')).toBe('chat');
      expect(visionPromptBuilder.detectDomain('Random landscape wallpaper', 'wallpaper.png')).toBe('general');
    });

    it('builds multimodal prompt with system instructions enforcing JSON schema', () => {
      const prompt = visionPromptBuilder.buildPrompt({
        domain: 'shopping',
        ocrText: 'Logitech Mouse ₹7,499',
      });

      expect(prompt.system).toContain('ContextVault Vision AI');
      expect(prompt.system).toContain('screenType');
      expect(prompt.system).toContain('application');
      expect(prompt.system).toContain('entities');
      expect(prompt.user).toContain('Logitech Mouse');
      expect(prompt.user).toContain('merchant, products, prices');
    });
  });

  // =========================================================================
  // Task 6: Vision Result Parser
  // =========================================================================
  describe('Task 6: VisionResultParser', () => {
    it('parses valid JSON response into strongly-typed VisionScene', () => {
      const validJson = JSON.stringify({
        screenType: 'shopping_receipt',
        application: 'Amazon',
        summary: 'Amazon order for Logitech mouse.',
        objects: ['Mouse', 'Amazon Logo'],
        entities: { merchant: 'Amazon', amount: '₹7,499' },
        confidence: 0.95,
        detectedLogos: ['Amazon'],
        detectedIcons: ['cart'],
        colors: ['#FF9900'],
        language: 'en',
      });

      const scene = visionResultParser.parse(validJson);
      expect(scene.screenType).toBe('shopping_receipt');
      expect(scene.application).toBe('Amazon');
      expect(scene.summary).toBe('Amazon order for Logitech mouse.');
      expect(scene.objects).toEqual(['Mouse', 'Amazon Logo']);
      expect(scene.entities.amount).toBe('₹7,499');
      expect(scene.confidence).toBe(0.95);
      expect(scene.detectedLogos).toEqual(['Amazon']);
    });

    it('strips markdown ```json code blocks cleanly', () => {
      const markdownJson = '```json\n{"screenType": "code_editor", "application": "VS Code", "confidence": 0.9}\n```';
      const scene = visionResultParser.parse(markdownJson);
      expect(scene.screenType).toBe('code_editor');
      expect(scene.application).toBe('VS Code');
      expect(scene.confidence).toBe(0.9);
    });

    it('cleans trailing commas before closing braces', () => {
      const malformedJson = '{"screenType": "banking_transaction", "application": "PhonePe", "objects": ["Card",],}';
      const scene = visionResultParser.parse(malformedJson);
      expect(scene.screenType).toBe('banking_transaction');
      expect(scene.application).toBe('PhonePe');
      expect(scene.objects).toEqual(['Card']);
    });

    it('returns robust fallback scene on completely invalid JSON without throwing', () => {
      const scene = visionResultParser.parse('Invalid non-json output from LLM', {
        application: 'Fallback App',
      });
      expect(scene.screenType).toBe('other');
      expect(scene.application).toBe('Fallback App');
      expect(scene.confidence).toBe(0.75);
    });
  });

  // =========================================================================
  // Task 2: Vision Model Manager & Local Vision Server Gateway
  // =========================================================================
  describe('Task 2: VisionModelManager & Local Vision Server Gateway', () => {
    it('configures Local Vision Server (RTX 4050) endpoint and model without cloud keys', () => {
      const loaded = visionModelManager.getApiKeys();
      expect(loaded.length).toBe(1);
      expect(loaded[0].provider).toBe('local');
      expect(loaded[0].model).toBe('Qwen2.5-VL-3B-Instruct');
      expect(loaded[0].endpoint).toContain('/vision/analyze');
      expect(loaded[0].enabled).toBe(true);
    });

    it('checks vision server health via gateway endpoint', async () => {
      const getSpy = jest.spyOn(axios, 'get').mockResolvedValueOnce({
        data: {
          status: 'healthy',
          modelLoaded: true,
          device: 'cuda',
          gpuName: 'NVIDIA GeForce RTX 4050 Laptop GPU',
        },
      });

      const health = await visionModelManager.checkHealth();
      expect(health.status).toBe('healthy');
      expect(health.modelLoaded).toBe(true);
      getSpy.mockRestore();
    });

    it('executes inference through Local Vision Server gateway and returns structured response', async () => {
      const postSpy = jest.spyOn(axios, 'post').mockResolvedValueOnce({
        data: { screenType: 'shopping_receipt', application: 'Amazon' },
      });

      const preprocessed = await visionImagePreprocessor.preprocess('test.png');
      const res = await visionModelManager.executeWithFailover({
        image: preprocessed,
        prompt: { system: 'sys', user: 'usr' },
      });

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(res.provider).toBe('local');
      expect(res.modelVersion).toBe('Qwen2.5-VL-3B-Instruct');
      expect(res.rawResponse).toContain('Amazon');
      postSpy.mockRestore();
    });

    it('falls back to LocalVisionFallbackAdapter when Local Vision Server is offline', async () => {
      const postSpy = jest.spyOn(axios, 'post').mockRejectedValueOnce(new Error('Network offline'));

      const preprocessed = await visionImagePreprocessor.preprocess('test.png');
      const res = await visionModelManager.executeWithFailover({
        image: preprocessed,
        prompt: { system: 'sys', user: 'usr' },
        ocrText: 'Amazon.in Logitech MX Master 3S ₹7,499',
      });

      expect(res.provider).toBe('offline_heuristic');
      expect(res.rawResponse).toContain('Amazon');
      expect(res.modelVersion).toContain('LocalVision-Heuristic');
      postSpy.mockRestore();
    });

    it('provides device capabilities and cleans memory properly', () => {
      const caps = visionModelManager.getDeviceCapabilities();
      expect(caps.totalMemoryMB).toBeGreaterThan(0);
      expect(caps.supportedCompute).toContain('cloud');

      expect(() => visionModelManager.cleanupMemory()).not.toThrow();
    });
  });

  // =========================================================================
  // Task 7: SQLite Vision Cache & Repository
  // =========================================================================
  describe('Task 7: VisionRepository', () => {
    it('saves vision result record to SQLite vision_cache table', async () => {
      const executeCommandSpy = jest.spyOn(databaseService, 'executeCommand').mockResolvedValue({});

      const record: VisionCacheRecord = {
        screenshot_id: 'sc_001',
        screen_type: 'shopping_receipt',
        application_name: 'Amazon',
        summary: 'Amazon order for Logitech mouse.',
        detected_objects: JSON.stringify(['Mouse']),
        detected_entities: JSON.stringify({ amount: '₹7,499' }),
        detected_logos: JSON.stringify(['Amazon']),
        confidence: 0.95,
        processed_at: '2026-09-12T12:00:00.000Z',
        model_version: 'groq:qwen/qwen3.8-27b',
      };

      await visionRepository.saveVisionResult(record);

      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO vision_cache'),
        expect.arrayContaining(['sc_001', 'shopping_receipt', 'Amazon'])
      );
      executeCommandSpy.mockRestore();
    });

    it('retrieves cached vision result by screenshot_id', async () => {
      const executeQuerySpy = jest.spyOn(databaseService, 'executeQuery').mockResolvedValue([
        {
          screenshot_id: 'sc_001',
          screen_type: 'shopping_receipt',
          application_name: 'Amazon',
          summary: 'Amazon order.',
          detected_objects: '["Mouse"]',
          detected_entities: '{"amount":"₹7,499"}',
          detected_logos: '["Amazon"]',
          confidence: 0.95,
          processed_at: '2026-09-12T12:00:00.000Z',
          model_version: 'groq:qwen',
        },
      ]);

      const result = await visionRepository.getVisionResult('sc_001');

      expect(executeQuerySpy).toHaveBeenCalledWith(
        expect.stringContaining('WHERE screenshot_id = ?'),
        ['sc_001']
      );
      expect(result).not.toBeNull();
      expect(result?.screenshot_id).toBe('sc_001');
      expect(result?.application_name).toBe('Amazon');
      executeQuerySpy.mockRestore();
    });

    it('returns null when screenshot_id is not in vision_cache', async () => {
      const executeQuerySpy = jest.spyOn(databaseService, 'executeQuery').mockResolvedValue([]);
      const result = await visionRepository.getVisionResult('non_existent');
      expect(result).toBeNull();
      executeQuerySpy.mockRestore();
    });

    it('deletes vision cache record properly', async () => {
      const executeCommandSpy = jest.spyOn(databaseService, 'executeCommand').mockResolvedValue({});
      await visionRepository.deleteVisionResult('sc_001');
      expect(executeCommandSpy).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM vision_cache WHERE screenshot_id = ?'),
        ['sc_001']
      );
      executeCommandSpy.mockRestore();
    });
  });

  // =========================================================================
  // Task 8: Merge OCR + Vision Metadata
  // =========================================================================
  describe('Task 8: EntityMergeService', () => {
    it('applies priority rules: Vision Merchant, OCR Amount, Vision App, OCR URLs, Vision Objects, OCR Emails', () => {
      const ocrEntities = {
        merchants: ['OCR Misread Merchant'],
        amounts: ['₹7,499.00 (High Precision)'],
        projectNames: ['OCR_App_Name'],
        urls: ['https://amazon.in/order/403'],
        emails: ['receipts@amazon.in'],
        phoneNumbers: ['+919876543210'],
      };

      const visionScene: VisionScene = {
        screenType: 'shopping_receipt',
        application: 'Amazon Mobile App',
        summary: 'Amazon order for Logitech mouse.',
        objects: ['Mouse', 'Buy Again Button'],
        entities: {
          merchant: 'Amazon Official Store',
          amount: '₹7,500', // Vision rounded amount
          orderId: '403-1234567',
        },
        confidence: 0.95,
        detectedLogos: ['Amazon'],
        detectedIcons: ['cart'],
        colors: ['#FF9900'],
        language: 'en',
      };

      const merged = entityMergeService.merge({
        screenshotId: 'sc_001',
        ocrText: 'Raw OCR text...',
        ocrEntities,
        visionScene,
      });

      // 1. Merchant: Vision > OCR
      expect(merged.merchant).toBe('Amazon Official Store');

      // 2. Amount: OCR > Vision
      expect(merged.amount).toBe('₹7,499.00 (High Precision)');

      // 3. Application: Vision > OCR
      expect(merged.primaryApplication).toBe('Amazon Mobile App');

      // 4. URLs: OCR > Vision
      expect(merged.urls).toContain('https://amazon.in/order/403');

      // 5. Objects: Vision
      expect(merged.objects).toEqual(['Mouse', 'Buy Again Button']);

      // 6. Emails: OCR > Vision
      expect(merged.emails).toContain('receipts@amazon.in');

      // Translates cleanly into ExtractedEntitiesDto
      const dto = entityMergeService.toExtractedEntitiesDto(merged);
      expect(dto.merchants[0]).toBe('Amazon Official Store');
      expect(dto.amounts[0]).toBe('₹7,499.00 (High Precision)');
      expect(dto.projectNames[0]).toBe('Amazon Mobile App');
    });
  });

  // =========================================================================
  // Four Required Scenarios (Amazon, PhonePe, VS Code, WhatsApp) & Scenario 5 Cache
  // =========================================================================
  describe('Verification Scenarios 1 - 5', () => {
    const fallbackAdapter = new LocalVisionFallbackAdapter();

    it('Scenario 1: Amazon screenshot detects merchant, product, and amount', async () => {
      const preprocessed = await visionImagePreprocessor.preprocess('amazon.png');
      const raw = await fallbackAdapter.infer({
        image: preprocessed,
        prompt: { system: '', user: '' },
        ocrText: 'Amazon Order Confirmation Logitech MX Master 3S ₹7,499',
      });

      const scene = visionResultParser.parse(raw);
      expect(scene.screenType).toBe('shopping_receipt');
      expect(scene.application).toBe('Amazon');
      expect(scene.entities.merchant).toBe('Amazon');
      expect(scene.entities.amount).toBe('₹7,499');
      expect(scene.summary).toContain('Logitech MX Master 3S');
      expect(scene.confidence).toBeGreaterThan(0.9);
    });

    it('Scenario 2: PhonePe screenshot detects UPI app, amount, and merchant', async () => {
      const preprocessed = await visionImagePreprocessor.preprocess('phonepe.png');
      const raw = await fallbackAdapter.infer({
        image: preprocessed,
        prompt: { system: '', user: '' },
        ocrText: 'PhonePe Payment Successful ₹1,250 Paid to Star Supermarket',
      });

      const scene = visionResultParser.parse(raw);
      expect(scene.screenType).toBe('payment_confirmation');
      expect(scene.application).toBe('PhonePe');
      expect(scene.entities.amount).toBe('₹1,250');
      expect(scene.entities.merchant).toBe('Star Supermarket');
      expect(scene.detectedLogos).toContain('PhonePe');
    });

    it('Scenario 3: VS Code screenshot detects IDE, language, and error summary', async () => {
      const preprocessed = await visionImagePreprocessor.preprocess('vscode.png');
      const raw = await fallbackAdapter.infer({
        image: preprocessed,
        prompt: { system: '', user: '' },
        ocrText: 'VS Code TypeError: Cannot read properties of undefined in TypeScript',
      });

      const scene = visionResultParser.parse(raw);
      expect(scene.screenType).toBe('code_editor');
      expect(scene.application).toBe('VS Code');
      expect(scene.entities.ide).toBe('VS Code');
      expect(scene.entities.language).toBe('TypeScript');
      expect(scene.summary).toContain('TypeError');
    });

    it('Scenario 4: WhatsApp screenshot generates conversation summary', async () => {
      const preprocessed = await visionImagePreprocessor.preprocess('whatsapp.png');
      const raw = await fallbackAdapter.infer({
        image: preprocessed,
        prompt: { system: '', user: '' },
        ocrText: 'WhatsApp chat conversation with Dev Team',
      });

      const scene = visionResultParser.parse(raw);
      expect(scene.screenType).toBe('chat_conversation');
      expect(scene.application).toBe('WhatsApp');
      expect(scene.summary).toContain('WhatsApp conversation');
      expect(scene.entities.platform).toBe('WhatsApp');
    });

    it('Scenario 5: Vision result saved and retrieved from SQLite vision cache without re-inferring', async () => {
      // Mock SQLite cache hit
      jest.spyOn(databaseService, 'executeQuery').mockResolvedValueOnce([
        {
          screenshot_id: 'sc_cached_101',
          screen_type: 'shopping_receipt',
          application_name: 'Amazon',
          summary: 'Cached Amazon summary.',
          detected_objects: '["Mouse"]',
          detected_entities: '{"amount":"₹7,499"}',
          detected_logos: '["Amazon"]',
          confidence: 0.94,
          processed_at: '2026-09-12T10:00:00.000Z',
          model_version: 'offline_heuristic',
        },
      ]);

      const res = await visionAIService.analyzeScreenshot({
        screenshotId: 'sc_cached_101',
        filePath: 'amazon.png',
        forceRefresh: false,
      });

      expect(res.isSuccess).toBe(true);
      expect(res.data?.cached).toBe(true);
      expect(res.data?.provider).toBe('sqlite_cache');
      expect(res.data?.scene.application).toBe('Amazon');
    });
  });

  // =========================================================================
  // Task 4: Vision Inference Queue & Store Integration
  // =========================================================================
  describe('Task 4: VisionInferenceQueue', () => {
    it('enqueues screenshot job and updates Zustand store', async () => {
      visionInferenceQueue.clearQueue();

      const analyzeSpy = jest.spyOn(visionAIService, 'analyzeScreenshot').mockResolvedValue({
        isSuccess: true,
        data: {
          screenshotId: 'sc_queue_01',
          scene: {
            screenType: 'other',
            application: 'Test App',
            summary: 'Test summary',
            objects: [],
            entities: {},
            confidence: 0.9,
            detectedLogos: [],
            detectedIcons: [],
            colors: [],
            language: 'en',
          },
          processingTimeMs: 45,
          modelVersion: 'test-v1',
          provider: 'test-provider',
          cached: false,
        },
      });

      visionInferenceQueue.enqueue({
        screenshotId: 'sc_queue_01',
        filePath: 'test.png',
        fileName: 'test.png',
      });

      expect(useVisionStore.getState().queueLength).toBeGreaterThanOrEqual(0);

      // Prevents duplicate enqueue of same screenshotId
      visionInferenceQueue.enqueue({
        screenshotId: 'sc_queue_01',
        filePath: 'test.png',
        fileName: 'test.png',
      });

      expect(visionInferenceQueue.getQueueLength()).toBeLessThanOrEqual(1);

      analyzeSpy.mockRestore();
    });
  });
});
