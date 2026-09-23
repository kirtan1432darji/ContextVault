import axios from 'axios';
import { Result } from '../utils/result';
import { mediaObserverService } from './backgroundDetection/mediaObserver';
import { EnvironmentManager } from '../config/EnvironmentManager';
import { ScreenshotAnalysisResult } from './visionAIService';

export interface OpenAIVisionOptions {
  model?: string;
  apiKey?: string;
  maxTokens?: number;
  timeoutMs?: number;
}

export class OpenAIVisionService {
  private static instance: OpenAIVisionService | null = null;
  private readonly defaultModel = 'gpt-4o-mini';
  private readonly endpoint = 'https://api.openai.com/v1/chat/completions';

  static getInstance(): OpenAIVisionService {
    if (!OpenAIVisionService.instance) {
      OpenAIVisionService.instance = new OpenAIVisionService();
    }
    return OpenAIVisionService.instance;
  }

  /**
   * Returns whether OpenAI API Key is configured and ready to use.
   * Disabled in favor of Local AI Qwen + On-Device Google ML Kit.
   */
  isAvailable(_customKey?: string): boolean {
    return false;
  }

  /**
   * Resolves the OpenAI API key from arguments, EnvironmentManager, or process.env.
   */
  resolveApiKey(customKey?: string): string {
    if (customKey && customKey.trim().length > 0) {
      return customKey.trim();
    }
    const envKey = EnvironmentManager.getOpenAiApiKey();
    if (envKey && envKey.trim().length > 0) {
      return envKey.trim();
    }
    if (typeof process !== 'undefined') {
      const processKey = process.env.OPEN_AI_API_KEY || process.env.OPENAI_API_KEY;
      if (processKey && processKey.trim().length > 0) {
        return processKey.trim();
      }
    }
    return '';
  }

  /**
   * Analyzes a screenshot using OpenAI Vision (gpt-4o-mini) and classifies it into
   * one of ContextVault's canonical Smart Folder categories with structured entities.
   */
  async analyzeScreenshot(params: {
    screenshotId: string;
    filePath: string;
    fileName?: string;
    options?: OpenAIVisionOptions;
  }): Promise<Result<ScreenshotAnalysisResult>> {
    const startTime = Date.now();
    const apiKey = this.resolveApiKey(params.options?.apiKey);

    if (!apiKey) {
      return Result.failure(
        'OPEN_AI_API_KEY is not configured in .env or environment.',
        'MISSING_OPENAI_KEY'
      );
    }

    try {
      // 1. Convert image to Base64 (sampled to max 1024px)
      const base64 = await mediaObserverService.getBase64Image(params.filePath, 1024);
      if (!base64 || base64.trim().length === 0) {
        return Result.failure(
          'Failed to convert screenshot to Base64 image.',
          'IMAGE_ENCODE_ERROR'
        );
      }

      const model = params.options?.model || this.defaultModel;
      const timeout = params.options?.timeoutMs || 30000;
      const fileName = params.fileName || 'Screenshot.png';

      // 2. Build system and user prompt for ContextVault canonical categories
      const systemPrompt = `You are ContextVault's on-device AI screenshot classifier and intelligence engine.
Analyze the user's screenshot image and determine the single most accurate category and subcategory.

Canonical Categories:
- Finance (payments, UPI, bank transfers, credit cards, bills, receipts, PhonePe, Google Pay, Paytm, Zerodha, Groww, bank SMS)
- Shopping (e-commerce orders, cart, tracking, Amazon, Flipkart, Myntra, Meesho, Ajio, order confirmations)
- Food Delivery (Swiggy, Zomato, Blinkit, Zepto, Instamart, BigBasket, restaurant orders)
- Chats (WhatsApp, Telegram, Signal, Discord, Instagram DM, SMS conversations)
- Social Media (Instagram posts/reels, Twitter/X, LinkedIn, Facebook, Reddit, YouTube)
- Travel (flight tickets, boarding pass, train PNR, IRCTC, MakeMyTrip, Uber, Ola, hotel booking)
- Documents (Aadhaar, PAN card, passport, driving license, certificates, legal contracts, official IDs)
- Health (prescriptions, medical reports, lab tests, doctor consults, medicines, 1mg, Apollo)
- Education (study materials, lecture notes, question papers, courses, exam schedules)
- Work (code, terminal, IDE, VS Code, Jira, Slack, emails, spreadsheets, presentations, GitHub)
- Entertainment (movies, songs, Netflix, Spotify, BookMyShow, games, memes)
- Utilities (electricity bills, mobile recharge, Wi-Fi bills, gas, water bills)
- Other (anything not fitting above)

Respond strictly in JSON format matching this schema:
{
  "category": "Finance" | "Shopping" | "Food Delivery" | "Chats" | "Social Media" | "Travel" | "Documents" | "Health" | "Education" | "Work" | "Entertainment" | "Utilities" | "Other",
  "subcategory": string,
  "title": string,
  "summary": string,
  "confidence": number,
  "merchant": string or null,
  "amount": number or null,
  "currency": string or null,
  "date": string,
  "entities": {
    "merchant"?: string,
    "amount"?: number,
    "currency"?: string,
    "transactionId"?: string,
    "referenceNumber"?: string,
    "orderId"?: string,
    "date"?: string
  },
  "tags": string[],
  "ocr_text": string,
  "bullet_points": string[]
}`;

      // 3. Dispatch POST request to OpenAI Chat Completions API
      const requestPayload = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this screenshot (File name: "${fileName}"). Classify it into the correct category, extract key entities (merchant, amount, date), summary, and all readable text (OCR).`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64}`,
                },
              },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: params.options?.maxTokens || 1200,
      };

      const response = await axios.post(this.endpoint, requestPayload, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout,
      });

      const choice = response.data?.choices?.[0];
      const rawContent = choice?.message?.content;
      if (!rawContent) {
        return Result.failure(
          'OpenAI returned an empty response.',
          'EMPTY_OPENAI_RESPONSE'
        );
      }

      let parsed: any;
      try {
        parsed = JSON.parse(rawContent);
      } catch (parseErr: any) {
        return Result.failure(
          `Failed to parse OpenAI JSON output: ${parseErr?.message}`,
          'JSON_PARSE_ERROR'
        );
      }

      // 4. Normalize parsed OpenAI response into ScreenshotAnalysisResult
      const processingTimeMs = Date.now() - startTime;
      const normalizedResult = this.normalizeOpenAIResponse(parsed, processingTimeMs);

      return Result.success(normalizedResult);
    } catch (err: any) {
      const processingTimeMs = Date.now() - startTime;
      const errorMessage =
        err?.response?.data?.error?.message || err?.message || 'Unknown OpenAI Vision error';
      console.warn(`[OpenAIVisionService] OpenAI inference failed after ${processingTimeMs}ms:`, errorMessage);
      return Result.failure(errorMessage, 'OPENAI_API_ERROR');
    }
  }

  /**
   * Normalizes raw OpenAI JSON output into standard ContextVault ScreenshotAnalysisResult.
   */
  private normalizeOpenAIResponse(
    raw: any,
    processingTimeMs: number
  ): ScreenshotAnalysisResult {
    const rawCategory = String(raw.category || 'Other').trim();
    // Capitalize first letter properly
    const category =
      rawCategory.charAt(0).toUpperCase() + rawCategory.slice(1);

    const subcategory = String(
      raw.subcategory || raw.merchant || raw.application || 'General'
    ).trim();

    const title = String(raw.title || `${category} - ${subcategory}`).trim();
    const summary = String(
      raw.summary || `${category} screenshot analyzed by OpenAI Vision`
    ).trim();

    let confidence = Number(raw.confidence ?? 0.95);
    if (confidence > 1.0) {
      confidence = confidence <= 100 ? confidence / 100 : 0.95;
    }

    const merchant = raw.merchant || raw.entities?.merchant || (subcategory !== 'General' ? subcategory : undefined);
    let amount: number | undefined = undefined;
    if (raw.amount !== undefined && raw.amount !== null && !isNaN(Number(raw.amount))) {
      amount = Number(raw.amount);
    } else if (raw.entities?.amount !== undefined && raw.entities?.amount !== null && !isNaN(Number(raw.entities?.amount))) {
      amount = Number(raw.entities?.amount);
    }

    const currency = String(raw.currency || raw.entities?.currency || 'INR');
    const date = String(raw.date || raw.entities?.date || new Date().toISOString());

    const entities: Record<string, any> = {
      ...(raw.entities || {}),
    };
    if (merchant) entities.merchant = merchant;
    if (amount !== undefined) entities.amount = amount;
    if (currency) entities.currency = currency;
    if (date) entities.date = date;

    const tags: string[] = Array.isArray(raw.tags) && raw.tags.length > 0
      ? raw.tags.map((t: any) => String(t).toLowerCase())
      : ['screenshot', category.toLowerCase()];

    if (merchant && !tags.includes(merchant.toLowerCase())) {
      tags.push(merchant.toLowerCase());
    }

    const folder_hierarchy: string[] =
      merchant && merchant.toLowerCase() !== category.toLowerCase()
        ? [category, merchant]
        : [category];

    const ocr_text = String(raw.ocr_text || summary).trim();
    const bullet_points = Array.isArray(raw.bullet_points)
      ? raw.bullet_points.map((b: any) => String(b))
      : [summary];

    return {
      title,
      summary,
      confidence,
      screen_type: category.toLowerCase().replace(/\s+/g, '_'),
      category,
      folder_hierarchy,
      merchant,
      amount,
      currency,
      payment_method: raw.payment_method || entities.payment_method || (category === 'Finance' ? 'UPI' : undefined),
      date,
      entities,
      tags,
      ocr_text,
      bullet_points,
      cached: false,
      processingTimeMs,
    };
  }
}

export const openAIVisionService = OpenAIVisionService.getInstance();
