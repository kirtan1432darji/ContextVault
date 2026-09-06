import { databaseService } from '../database';
import { TagModel } from '../../models';

export class TagRepository {
  async getTagsForScreenshot(screenshotId: string): Promise<TagModel[]> {
    const sql = `
      SELECT t.id, t.name, t.color_hex 
      FROM tags t
      INNER JOIN screenshot_tags st ON st.tag_id = t.id
      WHERE st.screenshot_id = ?
    `;
    const rows = await databaseService.executeQuery(sql, [screenshotId]);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      colorHex: r.color_hex,
    }));
  }

  async addTag(tag: TagModel): Promise<void> {
    await databaseService.executeCommand(
      'INSERT OR IGNORE INTO tags (id, name, color_hex) VALUES (?, ?, ?)',
      [tag.id, tag.name, tag.colorHex]
    );
  }

  async linkScreenshotTag(screenshotId: string, tagId: string): Promise<void> {
    await databaseService.executeCommand(
      'INSERT OR IGNORE INTO screenshot_tags (screenshot_id, tag_id) VALUES (?, ?)',
      [screenshotId, tagId]
    );
  }
}

export const tagRepository = new TagRepository();
