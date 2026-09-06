import { Result } from '../utils/result';
import { ClassificationResultModel, ClassifyRequestPayload } from '../models';
import { apiClient } from '../api/apiClient';
import { mediaClassifier } from './mediaClassifier';
import { DEFAULT_CATEGORIES } from '../models/category.model';

export class ClassificationService {
  async classifyScreenshot(
    payload: ClassifyRequestPayload
  ): Promise<Result<ClassificationResultModel>> {
    // 1. Try remote API first
    const remoteRes = await apiClient.classifyScreenshot(payload);
    if (remoteRes.isSuccess && remoteRes.data) {
      return remoteRes;
    }

    // 2. Fallback to local heuristic rule classifier
    const heuristic = mediaClassifier.classifyMediaItem({
      fileName: payload.fileName,
      filePath: payload.filePath,
      ocrText: payload.ocrText,
      sourceApp: payload.sourceApp,
      visionDescription: payload.visionDescription,
    });

    const category =
      DEFAULT_CATEGORIES.find(
        (c) => c.name.toLowerCase() === heuristic.categoryName.toLowerCase()
      ) || DEFAULT_CATEGORIES[0];

    const result: ClassificationResultModel = {
      screenshotId: payload.screenshotId,
      categoryId: category.id,
      categoryName: category.name,
      subcategory: heuristic.subcategory,
      folderPath: heuristic.folderPath,
      confidence: heuristic.confidence,
      suggestedTags: heuristic.tags,
      keywords: heuristic.tags,
      summary: `Organized into ${heuristic.categoryName}`,
      isAutoCategorized: true,
    };

    return Result.success(result);
  }
}

export const classificationService = new ClassificationService();
