import { useState, useEffect } from 'react';
import { FileText, CheckCircle, XCircle } from 'lucide-react';
import { requestsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Badge, Button, Card, LoadingSpinner, EmptyState, Alert } from '../components/ui';
import VoiceAssistanceButton from '../components/VoiceAssistanceButton';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function RequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [noticeType, setNoticeType] = useState('info');
  const [actingId, setActingId] = useState(null);

  function notify(msg, type = 'success') {
    setNotice(msg);
    setNoticeType(type);
    setTimeout(() => setNotice(''), 5000);
  }

  async function load() {
    try {
      const data = await requestsApi.list();
      setRequests(data);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function act(id, status) {
    setActingId(id);
    try {
      await requestsApi.update(id, status);
      notify(`Request ${status.toLowerCase()} successfully.`);
      load();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setActingId(null);
    }
  }

  const canApprove = user?.role === 'OFFICER' || user?.role === 'ADMIN';

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <FileText className="w-6 h-6 text-brand" />
        <h1 className="text-xl font-bold font-display">Medicine Transfer Requests</h1>
        <span className="text-sm text-gray-500">{requests.length} total</span>
      </div>

      {notice && <Alert type={noticeType}>{notice}</Alert>}

      <Card>
        {requests.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No requests yet"
            description="When medicines are requested, they will appear here."
          />
        ) : (
          <div className="divide-y divide-gray-100">
            {requests.map(req => {
              const speakText = `Request ID ${req.id}. Medicine: ${req.medicine}. Quantity: ${req.quantity}. Status: ${req.status}. Transfer from ${req.destination_phc} to ${req.source_phc}.`;
              return (
                <div key={req.id} className="px-6 py-4 flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono text-xs text-gray-400">#{req.id}</span>
                      <Badge variant={req.status}>{req.status}</Badge>
                      <VoiceAssistanceButton text={speakText} className="scale-90 border-0 bg-transparent py-0 px-1 hover:bg-gray-100" />
                    </div>
                    <p className="font-semibold text-gray-900">{req.medicine}</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Qty: {req.quantity} · From: <span className="font-medium">{req.destination_phc}</span> → To: <span className="font-medium">{req.source_phc}</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{formatDate(req.created_at)}</p>
                    {req.notes && <p className="text-xs text-gray-500 mt-1 italic">{req.notes}</p>}
                  </div>

                  {canApprove && req.status === 'PENDING' && (
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        onClick={() => act(req.id, 'APPROVED')}
                        loading={actingId === req.id}
                      >
                        <CheckCircle className="w-4 h-4" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => act(req.id, 'REJECTED')}
                        loading={actingId === req.id}
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <p className="text-xs text-gray-400 italic text-center">
        PHC-Sync creates and tracks transfer requests only. Medicine delivery is handled by PHC staff.
      </p>
    </div>
  );
}
