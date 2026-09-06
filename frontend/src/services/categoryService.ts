import { Result } from '../utils/result';
import { CategoryModel, DEFAULT_CATEGORIES } from '../models';
import { apiClient } from '../api/apiClient';

export class CategoryService {
  async getCategories(): Promise<Result<CategoryModel[]>> {
    const res = await apiClient.fetchCategories();
    if (res.isSuccess && res.data.length > 0) {
      return res;
    }
    // Fallback to canonical categories
    return Result.success(DEFAULT_CATEGORIES);
  }
}

export const categoryService = new CategoryService();
