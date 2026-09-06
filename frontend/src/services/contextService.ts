import { Result } from '../utils/result';
import { FolderContextModel, createEmptyFolderContext } from '../models';
import { apiClient } from '../api/apiClient';

export class ContextService {
  async getFolderContext(categoryId: string, categoryName: string): Promise<Result<FolderContextModel>> {
    const res = await apiClient.fetchFolderContext(categoryId);
    if (res.isSuccess && res.data) {
      return res;
    }
    // Return empty placeholder if none exists yet
    return Result.success(createEmptyFolderContext(categoryId, categoryName));
  }

  async generateFolderContext(categoryId: string): Promise<Result<FolderContextModel>> {
    return apiClient.generateFolderContext(categoryId);
  }
}

export const contextService = new ContextService();
