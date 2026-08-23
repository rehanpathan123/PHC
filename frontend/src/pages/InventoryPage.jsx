import { useState, useEffect } from 'react';
import { Package, Edit2, Check, X } from 'lucide-react';
import { inventoryApi, phcsApi } from '../services/api';
import { Badge, Button, Card, CardHeader, CardBody, Select, Input, LoadingSpinner, EmptyState, Alert } from '../components/ui';
import VoiceAssistanceButton from '../components/VoiceAssistanceButton';

export default function InventoryPage() {
  const [phcs, setPhcs] = useState([]);
  const [selectedPhc, setSelectedPhc] = useState(1);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState(null);
  const [editQty, setEditQty] = useState('');
  const [notice, setNotice] = useState('');
  const [noticeType, setNoticeType] = useState('info');

  function notify(msg, type = 'success') {
    setNotice(msg);
    setNoticeType(type);
    setTimeout(() => setNotice(''), 5000);
  }

  useEffect(() => {
    phcsApi.list().then(setPhcs);
  }, []);

  useEffect(() => {
    setLoading(true);
    inventoryApi.getByPhc(selectedPhc).then(setInventory).finally(() => setLoading(false));
  }, [selectedPhc]);

  async function saveEdit(item) {
    try {
      await inventoryApi.update(item.id, { quantity: Number(editQty) });
      setInventory(inv => inv.map(i => i.id === item.id ? { ...i, quantity: Number(editQty), status: Number(editQty) === 0 ? 'OUT_OF_STOCK' : Number(editQty) <= i.minimum_stock ? 'LOW_STOCK' : 'AVAILABLE' } : i));
      notify('Stock updated successfully.');
      setEditId(null);
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  const stats = {
    available: inventory.filter(i => i.status === 'AVAILABLE').length,
    low:       inventory.filter(i => i.status === 'LOW_STOCK').length,
    out:       inventory.filter(i => i.status === 'OUT_OF_STOCK').length,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Package className="w-6 h-6 text-brand" />
          <h1 className="text-xl font-bold font-display">Inventory</h1>
          <VoiceAssistanceButton text={`Inventory Overview. Available items: ${stats.available}. Low stock items: ${stats.low}. Out of stock items: ${stats.out}.`} className="scale-90 border-0 bg-transparent py-0 px-1 hover:bg-gray-100" />
        </div>
        <Select value={selectedPhc} onChange={e => setSelectedPhc(Number(e.target.value))} className="w-52">
          {phcs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Available', count: stats.available, color: 'text-green-700 bg-green-50 border-green-200' },
          { label: 'Low Stock', count: stats.low, color: 'text-amber-700 bg-amber-50 border-amber-200' },
          { label: 'Out of Stock', count: stats.out, color: 'text-red-700 bg-red-50 border-red-200' },
        ].map(({ label, count, color }) => (
          <div key={label} className={`rounded-xl border p-4 text-center ${color}`}>
            <p className="text-2xl font-bold font-display">{count}</p>
            <p className="text-xs font-semibold mt-1">{label}</p>
          </div>
        ))}
      </div>

      {notice && <Alert type={noticeType}>{notice}</Alert>}

      <Card>
        {loading ? <LoadingSpinner /> : inventory.length === 0 ? (
          <EmptyState icon={Package} title="No inventory records" description="No medicines listed for this PHC." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Medicine', 'Category', 'Quantity', 'Min Stock', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inventory.map(item => {
                  const speakText = `${item.medicine}. Category: ${item.category}. Quantity: ${item.quantity}. Minimum stock: ${item.minimum_stock}. Status: ${item.status?.replace('_', ' ')}.`;
                  return (
                    <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-gray-900 flex items-center gap-1.5">
                        <span>{item.medicine}</span>
                        <VoiceAssistanceButton text={speakText} className="scale-75 border-0 bg-transparent py-0 px-0.5 hover:bg-gray-100/50" />
                      </td>
                      <td className="px-4 py-3 text-gray-500">{item.category}</td>
                    <td className="px-4 py-3">
                      {editId === item.id ? (
                        <Input
                          type="number"
                          min="0"
                          value={editQty}
                          onChange={e => setEditQty(e.target.value)}
                          className="w-24"
                        />
                      ) : (
                        <span className="font-mono font-bold">{item.quantity}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{item.minimum_stock}</td>
                    <td className="px-4 py-3">
                      <Badge variant={item.status}>{item.status?.replace('_', ' ')}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {editId === item.id ? (
                        <div className="flex gap-1">
                          <button onClick={() => saveEdit(item)} className="p-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditId(null)} className="p-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditId(item.id); setEditQty(String(item.quantity)); }}
                          className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
