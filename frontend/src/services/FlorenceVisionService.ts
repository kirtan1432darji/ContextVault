/**
 * FlorenceVisionService.ts
 * ContextVault - Local Florence-2 Specialist Visual Extraction Client
 *
 * Communicates with the local Florence-2 server (port 8002) or backend /api/florence proxy
 * to extract high-density visual evidence: OCR with regions, dense captions, and UI elements.
 * Feeds visual evidence into SmartFolderClassificationService and Qwen reasoning.
 */

import axios from 'axios';
import { BackendConnectionManager } from './BackendConnectionManager';
import { Result } from '../utils/result';

export interface FlorenceTextRegion {
  text: string;
  box_2d: [number, number, number, number];
}

export interface FlorenceDetectedElement {
  label: string;
  box_2d: [number, number, number, number];
}

export interface FlorenceVisualEvidence {
  caption: string;
  detailedDescription: string;
  ocrText: string;
  textRegions: FlorenceTextRegion[];
  detectedElements: FlorenceDetectedElement[];
  visualConfidence?: number;
  processingTimeMs: number;
}

export interface FlorenceHealthResult {
  online: boolean;
  latencyMs: number;
  status: string;
  model?: string;
  gpu?: string;
  error?: string;
}

export class FlorenceVisionService {
  private static directCandidateUrls = [
    'http://127.0.0.1:8002',
    'http://10.187.86.96:8002',
    'http://192.168.100.2:8002',
    'http://10.0.2.2:8002', // Android emulator loopback
  ];

  private static activeBaseUrl: string | null = null;

  /**
   * Discovers the active Florence-2 server either via direct LAN candidates or backend proxy.
   */
  public static async getActiveServerUrl(): Promise<string> {
    if (this.activeBaseUrl) {
      return this.activeBaseUrl;
    }

    // 1. Try direct candidates first (fastest)
    for (const url of this.directCandidateUrls) {
      try {
        const res = await axios.get(`${url}/health`, { timeout: 1500 });
        if (res.status === 200 && res.data?.online) {
          console.log(`[FlorenceVisionService] Connected directly to Florence-2 at ${url}`);
          this.activeBaseUrl = url;
          return url;
        }
      } catch {
        // try next candidate
      }
    }

    // 2. Fall back to backend /api/florence proxy
    const backendUrl = `${BackendConnectionManager.getApiUrl()}/florence`;
    try {
      const res = await axios.get(`${backendUrl}/health`, { timeout: 2000 });
      if (res.status === 200) {
        console.log(`[FlorenceVisionService] Connected via backend proxy at ${backendUrl}`);
        this.activeBaseUrl = backendUrl;
        return backendUrl;
      }
    } catch {
      // Backend proxy unavailable
    }

    // Default fallback to first candidate
    return this.directCandidateUrls[0];
  }

  /**
   * Health check for Florence-2 service.
   */
  public static async ping(): Promise<FlorenceHealthResult> {
    const t0 = Date.now();
    try {
      const url = await this.getActiveServerUrl();
      const res = await axios.get(`${url}/health`, { timeout: 3000 });
      const latencyMs = Date.now() - t0;
      return {
        online: Boolean(res.data?.online),
        latencyMs,
        status: res.data?.status || 'online',
        model: res.data?.model,
        gpu: res.data?.gpu,
      };
    } catch (err: any) {
      return {
        online: false,
        latencyMs: Date.now() - t0,
        status: 'offline',
        error: err?.message || 'Florence-2 offline',
      };
    }
  }

  /**
   * Extracts visual evidence (OCR with bounding boxes, dense captions, UI elements)
   * from a local image file URI.
   */
  public static async extractVisualEvidence(
    imageUri: string,
    fileName?: string,
  ): Promise<Result<FlorenceVisualEvidence>> {
    const t0 = Date.now();
    try {
      const activeUrl = await this.getActiveServerUrl();
      const endpoint = activeUrl.endsWith('/florence')
        ? `${activeUrl}/extract`
        : `${activeUrl}/extract`;

      const formData = new FormData();
      formData.append('image', {
        uri: imageUri,
        type: 'image/jpeg',
        name: fileName || `florence_${Date.now()}.jpg`,
      } as any);

      const res = await axios.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });

      const data = res.data;
      if (!data || !data.success) {
        return Result.failure(data?.error || 'Extraction failed', 'FLORENCE_EXTRACTION_ERROR');
      }

      const evidence: FlorenceVisualEvidence = {
        caption: data.caption || '',
        detailedDescription: data.detailed_caption || '',
        ocrText: data.ocr?.text || '',
        textRegions: data.ocr?.regions || [],
        detectedElements: data.objects || [],
        visualConfidence: 0.95,
        processingTimeMs: data.processing_time_ms || (Date.now() - t0),
      };

      return Result.success(evidence);
    } catch (err: any) {
      console.warn(`[FlorenceVisionService] Extraction error: ${err.message}`);
      return Result.failure(err.message || 'Florence-2 extraction failed', 'NETWORK_ERROR');
    }
  }
}
