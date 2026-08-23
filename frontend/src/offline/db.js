/**
 * Offline-first storage using Dexie.js + IndexedDB.
 *
 * Schema:
 *   local_id     — auto-increment primary key
 *   type         — "patient" | "assessment"
 *   payload      — the data object
 *   created_at   — ISO timestamp
 *   sync_status  — PENDING | SYNCING | SYNCED | FAILED
 *   retry_count  — number of failed attempts
 *   server_id    — set after successful sync
 */
import Dexie from 'dexie';

export const db = new Dexie('phc-sync-v2');

db.version(1).stores({
  offlineRecords: '++local_id, type, sync_status, created_at',
});

// ── Helpers ────────────────────────────────────────────────────────────────────

export async function saveOfflinePatient(payload) {
  return db.offlineRecords.add({
    type: 'patient',
    payload,
    created_at: new Date().toISOString(),
    sync_status: 'PENDING',
    retry_count: 0,
  });
}

export async function getPendingCount() {
  return db.offlineRecords
    .where('sync_status')
    .anyOf(['PENDING', 'FAILED'])
    .count();
}

export async function getPendingRecords() {
  return db.offlineRecords
    .where('sync_status')
    .anyOf(['PENDING', 'FAILED'])
    .toArray();
}

export async function getAllOfflineRecords() {
  return db.offlineRecords.orderBy('created_at').reverse().toArray();
}

/**
 * Sync all pending offline records with the server.
 * Returns { synced, failed }.
 * IMPORTANT: never removes local records before server acknowledgement.
 */
export async function syncPendingRecords(pushFn) {
  const pending = await getPendingRecords();
  if (!pending.length) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const record of pending) {
    // Mark as SYNCING
    await db.offlineRecords.update(record.local_id, { sync_status: 'SYNCING' });

    try {
      const result = await pushFn([
        { local_id: String(record.local_id), payload: record.payload },
      ]);

      const serverResult = result?.results?.[0];
      if (serverResult?.status === 'SYNCED') {
        await db.offlineRecords.update(record.local_id, {
          sync_status: 'SYNCED',
          server_id: serverResult.patient_id,
        });
        synced++;
      } else {
        throw new Error(serverResult?.error || 'Server did not confirm sync');
      }
    } catch (err) {
      await db.offlineRecords.update(record.local_id, {
        sync_status: 'FAILED',
        retry_count: (record.retry_count || 0) + 1,
      });
      failed++;
    }
  }

  return { synced, failed };
}
