import {
  storageManagerService,
  StorageBreakdown,
  DuplicateGroup,
  DuplicateDetectionResult,
  CleanupRecommendation,
} from './storageManagerService';

export class StorageService {
  async getStorageBreakdown(): Promise<StorageBreakdown> {
    return storageManagerService.getStorageBreakdown();
  }

  async findDuplicates(): Promise<DuplicateDetectionResult> {
    return storageManagerService.findDuplicates();
  }

  async deleteDuplicates(duplicateIds: string[]): Promise<number> {
    return storageManagerService.cleanDuplicates(duplicateIds);
  }

  async cleanOldOCRCache(_retentionDays = 30): Promise<number> {
    await storageManagerService.clearOCRCache();
    return 1;
  }

  async clearSearchHistory(): Promise<number> {
    await storageManagerService.clearSearchCache();
    return 1;
  }

  async vacuumDatabase(): Promise<void> {
    return storageManagerService.vacuumDatabase();
  }

  async getCleanupRecommendations(): Promise<CleanupRecommendation[]> {
    const breakdown = await storageManagerService.getStorageBreakdown();
    const duplicates = await storageManagerService.findDuplicates();
    return storageManagerService.getCleanupRecommendations(breakdown, duplicates);
  }
}

export const storageService = new StorageService();
export type { StorageBreakdown, DuplicateGroup, DuplicateDetectionResult, CleanupRecommendation };
