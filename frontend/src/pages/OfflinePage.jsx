import { useState, useEffect } from 'react';
import { RefreshCw, Wifi, WifiOff, Clock, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { getAllOfflineRecords, getPendingCount, syncPendingRecords } from '../offline/db';
import { syncApi } from '../services/api';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { Badge, Button, Card, CardHeader, CardBody, Alert } from '../components/ui';

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
}

const STATUS_ICONS = {
  PENDING:  { icon: Clock, color: 'text-blue-600' },
  SYNCING:  { icon: Loader2, color: 'text-blue-600 animate-spin' },
  SYNCED:   { icon: CheckCircle, color: 'text-green-600' },
  FAILED:   { icon: AlertTriangle, color: 'text-red-600' },
};

export default function OfflinePage() {
  const online = useOnlineStatus();
  const [records, setRecords] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [lastSync] = useState(localStorage.getItem('phc_last_sync'));

  async function loadRecords() {
    const all = await getAllOfflineRecords();
    setRecords(all);
    const pending = await getPendingCount();
    setPendingCount(pending);
  }

  useEffect(() => { loadRecords(); }, []);

  async function handleSync() {
    if (!online) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await syncPendingRecords(syncApi.push);
      setSyncResult(result);
      const now = new Date().toLocaleTimeString();
      localStorage.setItem('phc_last_sync', now);
      await loadRecords();
    } catch (err) {
      setSyncResult({ error: err.message });
    } finally {
      setSyncing(false);
    }
  }

  // Auto-sync when coming back online
  useEffect(() => {
    if (online && pendingCount > 0) {
      handleSync();
    }
  }, [online]);

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <RefreshCw className="w-6 h-6 text-brand" />
        <h1 className="text-xl font-bold font-display">Offline Storage & Sync</h1>
      </div>

      {/* Status Card */}
      <Card>
        <CardBody>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${online ? 'bg-green-100' : 'bg-amber-100'}`}>
                {online ? <Wifi className="w-6 h-6 text-green-700" /> : <WifiOff className="w-6 h-6 text-amber-700" />}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{online ? 'Connected' : 'Offline Mode'}</p>
                <p className="text-sm text-gray-500">
                  {pendingCount > 0 ? `${pendingCount} record(s) pending sync` : 'All records synced'}
                </p>
                {lastSync && <p className="text-xs text-gray-400">Last sync: {lastSync}</p>}
              </div>
            </div>
            <Button onClick={handleSync} loading={syncing} disabled={!online || pendingCount === 0}>
              <RefreshCw className="w-4 h-4" />
              Sync Now
            </Button>
          </div>

          {syncResult && (
            <div className="mt-4">
              {syncResult.error ? (
                <Alert type="error">Sync failed: {syncResult.error}</Alert>
              ) : syncResult.synced > 0 ? (
                <Alert type="success">✅ {syncResult.synced} record(s) synchronized. {syncResult.failed > 0 && `${syncResult.failed} failed.`}</Alert>
              ) : (
                <Alert type="info">No records to sync.</Alert>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* How it works */}
      <Card>
        <CardHeader><p className="font-semibold text-gray-800">How Offline Sync Works</p></CardHeader>
        <CardBody>
          <div className="space-y-3 text-sm text-gray-600">
            {[
              ['📱', 'When offline, patients are saved to your device (IndexedDB) with status PENDING.'],
              ['🔄', 'When internet returns, PHC-Sync automatically syncs pending records.'],
              ['✅', 'Records are only removed from the local queue after the server confirms receipt.'],
              ['🔁', 'Failed records are retried. You can also manually press Sync Now.'],
            ].map(([icon, text]) => (
              <div key={text} className="flex items-start gap-3">
                <span className="text-lg">{icon}</span>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Records list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <p className="font-semibold text-gray-800">Local Records ({records.length})</p>
            <Button variant="ghost" size="sm" onClick={loadRecords}>
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        {records.length === 0 ? (
          <CardBody>
            <p className="text-center text-gray-400 text-sm py-6">No offline records stored.</p>
          </CardBody>
        ) : (
          <div className="divide-y divide-gray-100">
            {records.map(rec => {
              const { icon: StatusIcon, color } = STATUS_ICONS[rec.sync_status] || STATUS_ICONS.PENDING;
              return (
                <div key={rec.local_id} className="px-6 py-3 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 truncate">{rec.payload?.name || 'Unnamed Patient'}</p>
                    <p className="text-xs text-gray-500">{rec.payload?.village} · Age {rec.payload?.age} · {formatTime(rec.created_at)}</p>
                    {rec.retry_count > 0 && (
                      <p className="text-xs text-red-500">Retried {rec.retry_count}x</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant={rec.sync_status}>{rec.sync_status}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
