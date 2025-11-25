import { clickupApi } from "./clickup-api";
import { storage } from "./storage";

interface SyncResult {
  synced: number;
  alreadyLogged: number;
  tasks: Array<{
    id: string;
    name: string;
    clientName: string;
    completedAt: Date;
  }>;
}

let syncInterval: NodeJS.Timeout | null = null;
let lastSyncTime: Date | null = null;
const excludedTaskIds = new Set<string>();

export function excludeTasksFromSync(taskIds: string[]): void {
  for (const id of taskIds) {
    excludedTaskIds.add(id);
  }
  console.log(`[Sync] Added ${taskIds.length} tasks to exclusion list`);
}

export function getExcludedTaskIds(): string[] {
  return Array.from(excludedTaskIds);
}

export async function syncCompletedTasks(): Promise<SyncResult> {
  const result: SyncResult = {
    synced: 0,
    alreadyLogged: 0,
    tasks: [],
  };

  try {
    // Get start of today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0];

    // Fetch recently completed tasks from ClickUp
    const completedTasks = await clickupApi.getRecentlyCompletedTasks(today);

    // Process each completed task
    for (const task of completedTasks) {
      // Skip excluded tasks
      if (excludedTaskIds.has(task.id)) {
        continue;
      }
      
      // Extract client name from list name or tags
      const clientName = task.list?.name || 
        task.tags?.find(t => t.name)?.name || 
        "Unknown";

      // Parse completion time
      const dateDone = task.date_done || task.date_closed;
      const completedAt = dateDone 
        ? new Date(parseInt(dateDone, 10)) 
        : new Date();

      // Log this completion (returns false if already exists)
      const wasAdded = await storage.addCompletedMove(todayStr, {
        moveId: task.id,
        description: task.name,
        clientName,
        at: completedAt.toISOString(),
        source: "clickup_sync",
      });

      if (wasAdded) {
        // Only update client memory if move was actually added
        await storage.updateClientMove(clientName, task.id, task.name);

        // Track for result
        result.synced++;
        result.tasks.push({
          id: task.id,
          name: task.name,
          clientName,
          completedAt,
        });
      } else {
        result.alreadyLogged++;
      }
    }

    lastSyncTime = new Date();
    console.log(`[Sync] Synced ${result.synced} completed tasks, ${result.alreadyLogged} already logged`);
    
    return result;
  } catch (error) {
    console.error("[Sync] Error syncing completed tasks:", error);
    throw error;
  }
}

export function startSyncInterval(intervalMinutes: number = 15): void {
  if (syncInterval) {
    console.log("[Sync] Clearing existing sync interval");
    clearInterval(syncInterval);
  }

  const intervalMs = intervalMinutes * 60 * 1000;
  
  // Run immediately on start
  syncCompletedTasks().catch(err => {
    console.error("[Sync] Initial sync failed:", err);
  });

  // Then run on interval
  syncInterval = setInterval(() => {
    syncCompletedTasks().catch(err => {
      console.error("[Sync] Scheduled sync failed:", err);
    });
  }, intervalMs);

  console.log(`[Sync] Started sync interval every ${intervalMinutes} minutes`);
}

export function stopSyncInterval(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log("[Sync] Stopped sync interval");
  }
}

export function getLastSyncTime(): Date | null {
  return lastSyncTime;
}

export function isSyncRunning(): boolean {
  return syncInterval !== null;
}
