import { databaseService } from '../database';

export interface MemoryTimelineRecord {
  id: string;
  eventDate: string; // YYYY-MM-DD
  eventPeriod: 'today' | 'yesterday' | 'this_week' | 'earlier_this_month' | 'older';
  eventType: string; // 'payment' | 'chat' | 'shopping' | 'travel' | 'general'
  summary: string;
  screenshotIds: string[];
  createdAt: string;
}

export class MemoryTimelineRepository {
  async upsertEvent(record: MemoryTimelineRecord): Promise<void> {
    await databaseService.executeCommand(
      `INSERT OR REPLACE INTO memory_timeline (
        id, event_date, event_period, event_type, summary, screenshot_ids_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.eventDate,
        record.eventPeriod,
        record.eventType,
        record.summary,
        JSON.stringify(record.screenshotIds || []),
        record.createdAt,
      ]
    );
  }

  async getEventsByDate(dateStr: string): Promise<MemoryTimelineRecord[]> {
    const rows = await databaseService.executeQuery(
      `SELECT * FROM memory_timeline WHERE event_date = ? ORDER BY created_at DESC`,
      [dateStr]
    );
    return (rows || []).map(this.mapRow);
  }

  async getEventsByPeriod(period: string): Promise<MemoryTimelineRecord[]> {
    const rows = await databaseService.executeQuery(
      `SELECT * FROM memory_timeline WHERE event_period = ? ORDER BY created_at DESC`,
      [period]
    );
    return (rows || []).map(this.mapRow);
  }

  async getAllEvents(): Promise<MemoryTimelineRecord[]> {
    const rows = await databaseService.executeQuery(
      `SELECT * FROM memory_timeline ORDER BY created_at DESC`
    );
    return (rows || []).map(this.mapRow);
  }

  async deleteEvent(id: string): Promise<void> {
    await databaseService.executeCommand(
      `DELETE FROM memory_timeline WHERE id = ?`,
      [id]
    );
  }

  async deleteByScreenshotId(screenshotId: string): Promise<void> {
    const all = await this.getAllEvents();
    for (const evt of all) {
      if (evt.screenshotIds.includes(screenshotId)) {
        const remaining = evt.screenshotIds.filter((id) => id !== screenshotId);
        if (remaining.length === 0) {
          await this.deleteEvent(evt.id);
        } else {
          evt.screenshotIds = remaining;
          await this.upsertEvent(evt);
        }
      }
    }
  }

  async clearAll(): Promise<void> {
    await databaseService.executeCommand(`DELETE FROM memory_timeline`);
  }

  private mapRow(r: any): MemoryTimelineRecord {
    let screenshotIds: string[] = [];
    try {
      screenshotIds = JSON.parse(r.screenshot_ids_json || '[]');
    } catch {
      screenshotIds = [];
    }
    return {
      id: r.id,
      eventDate: r.event_date,
      eventPeriod: r.event_period,
      eventType: r.event_type,
      summary: r.summary,
      screenshotIds,
      createdAt: r.created_at,
    };
  }
}

export const memoryTimelineRepository = new MemoryTimelineRepository();
