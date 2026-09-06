import { Result } from '../utils/result';
import { ScreenshotModel } from '../models';
import { apiClient } from '../api/apiClient';

export class SearchService {
  async searchScreenshots(query: string, categoryId?: string): Promise<Result<ScreenshotModel[]>> {
    const res = await apiClient.search(query, categoryId);
    if (res.isSuccess && Array.isArray(res.data)) {
      return Result.success(res.data as ScreenshotModel[]);
    }
    return Result.success([]);
  }
}

export const searchService = new SearchService();
