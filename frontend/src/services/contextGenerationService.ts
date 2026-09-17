import { folderContextService } from './FolderContextService';
import { FolderContextModel } from '../models';

export class ContextGenerationService {
  async getOrGenerateContext(
    folderId: string,
    folderName: string,
    forceRefresh = false
  ): Promise<FolderContextModel> {
    return folderContextService.getOrGenerateContext(folderId, folderName, forceRefresh);
  }

  async generateFolderContext(folderId: string, folderName: string): Promise<FolderContextModel> {
    return folderContextService.generateFolderContext(folderId, folderName);
  }
}

export const contextGenerationService = new ContextGenerationService();
