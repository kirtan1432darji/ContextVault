import { ExtractedEntitiesDto } from '../models/classification.model';
import { UnifiedScreenshotMetadata, VisionScene } from '../vision/types';

export class EntityMergeService {
  /**
   * Merges OCR text/entities with Vision AI Scene metadata following strict priority rules:
   * 1. Merchant: Vision > OCR
   * 2. Amount: OCR > Vision
   * 3. App: Vision > OCR
   * 4. URLs: OCR > Vision
   * 5. Objects: Vision
   * 6. Emails: OCR > Vision
   */
  merge(params: {
    screenshotId: string;
    ocrText?: string;
    ocrEntities?: Partial<ExtractedEntitiesDto>;
    visionScene: VisionScene;
  }): UnifiedScreenshotMetadata {
    const { screenshotId, ocrText = '', ocrEntities, visionScene } = params;

    // 1. Merchant: Vision > OCR
    let merchant: string | undefined = undefined;
    if (visionScene.entities?.merchant && typeof visionScene.entities.merchant === 'string') {
      merchant = visionScene.entities.merchant.trim();
    } else if (ocrEntities?.merchants && ocrEntities.merchants.length > 0) {
      merchant = ocrEntities.merchants[0].trim();
    }

    // 2. Amount: OCR > Vision
    let amount: string | undefined = undefined;
    if (ocrEntities?.amounts && ocrEntities.amounts.length > 0) {
      amount = ocrEntities.amounts[0].trim();
    } else if (visionScene.entities?.amount && typeof visionScene.entities.amount === 'string') {
      amount = visionScene.entities.amount.trim();
    }

    // 3. Application: Vision > OCR
    let primaryApplication = 'Unknown';
    if (
      visionScene.application &&
      visionScene.application !== 'Unknown' &&
      visionScene.application !== 'Unknown Application'
    ) {
      primaryApplication = visionScene.application.trim();
    } else if (ocrEntities?.projectNames && ocrEntities.projectNames.length > 0) {
      primaryApplication = ocrEntities.projectNames[0].trim();
    }

    // 4. URLs: OCR > Vision
    const ocrUrls = ocrEntities?.urls || [];
    const visionUrls: string[] = [];
    if (visionScene.entities?.url && typeof visionScene.entities.url === 'string') {
      visionUrls.push(visionScene.entities.url.trim());
    }
    const urls = Array.from(new Set([...ocrUrls, ...visionUrls]));

    // 5. Objects: Vision
    const objects = Array.isArray(visionScene.objects) ? [...visionScene.objects] : [];

    // 6. Emails: OCR > Vision
    const ocrEmails = ocrEntities?.emails || [];
    const visionEmails: string[] = [];
    if (visionScene.entities?.email && typeof visionScene.entities.email === 'string') {
      visionEmails.push(visionScene.entities.email.trim());
    }
    const emails = Array.from(new Set([...ocrEmails, ...visionEmails]));

    // Additional fields
    const phoneNumbers = ocrEntities?.phoneNumbers || [];
    const orderId =
      visionScene.entities?.orderId || visionScene.entities?.referenceNumber || undefined;
    const referenceNumber =
      visionScene.entities?.referenceNumber || visionScene.entities?.utr || undefined;
    const deliveryDate =
      visionScene.entities?.deliveryDate || visionScene.entities?.date || undefined;

    return {
      screenshotId,
      screenType: visionScene.screenType || 'other',
      primaryApplication,
      merchant,
      amount,
      orderId: orderId ? String(orderId) : undefined,
      referenceNumber: referenceNumber ? String(referenceNumber) : undefined,
      deliveryDate: deliveryDate ? String(deliveryDate) : undefined,
      urls,
      emails,
      phoneNumbers,
      objects,
      detectedLogos: visionScene.detectedLogos || [],
      summary: visionScene.summary || '',
      ocrText,
      confidence: visionScene.confidence || 0.85,
      mergedAt: new Date().toISOString(),
    };
  }

  /**
   * Translates unified metadata into standard ExtractedEntitiesDto for backward compatibility.
   */
  toExtractedEntitiesDto(unified: UnifiedScreenshotMetadata): ExtractedEntitiesDto {
    return {
      merchants: unified.merchant ? [unified.merchant] : [],
      amounts: unified.amount ? [unified.amount] : [],
      urls: unified.urls,
      emails: unified.emails,
      phoneNumbers: unified.phoneNumbers,
      projectNames: [unified.primaryApplication],
      dates: unified.deliveryDate ? [unified.deliveryDate] : [],
    };
  }
}

export const entityMergeService = new EntityMergeService();
