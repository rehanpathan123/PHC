import { useState, useEffect } from 'react';
import { Package, Search, Sparkles } from 'lucide-react';
import { inventoryApi, requestsApi, phcsApi, aiApi } from '../services/api';
import {
  Badge, Button, Card, CardHeader, CardBody,
  Select, LoadingSpinner, EmptyState, Alert
} from '../components/ui';
import VoiceAssistanceButton from '../components/VoiceAssistanceButton';

export default function MedicinePage() {
  const [medicines, setMedicines] = useState([]);
  const [phcs, setPhcs] = useState([]);
  const [selectedMed, setSelectedMed] = useState('');
  const [currentPhcId, setCurrentPhcId] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeType, setNoticeType] = useState('info');
  
  // AI recommendation states
  const [aiRecommendation, setAiRecommendation] = useState(null);
  const [aiRecLoading, setAiRecLoading] = useState(false);

  useEffect(() => {
    inventoryApi.getAllMedicines().then(m => {
      setMedicines(m);
      if (m.length) setSelectedMed(String(m[0].id));
    });
    phcsApi.list().then(setPhcs);
  }, []);

  async function checkAvailability() {
    if (!selectedMed) return;
    setLoading(true);
    setResult(null);
    setNotice('');
    setAiRecommendation(null);
    try {
      const data = await inventoryApi.availability(selectedMed, currentPhcId);
      setResult(data);

      // If current PHC is out of stock and we have recommended PHC, query AI Recommendation Explanation
      if (!data.current_phc_available && data.recommended_phc) {
        setAiRecLoading(true);
        try {
          const rec = await aiApi.phcRecommendation({
            current_phc_id: Number(currentPhcId),
            medicine_id: Number(selectedMed),
            required_quantity: 10,
          });
          setAiRecommendation(rec);
        } catch (aiErr) {
          console.error('Failed to load AI PHC recommendation explanation: ', aiErr);
        } finally {
          setAiRecLoading(false);
        }
      }
    } catch (err) {
      setNotice(err.message);
      setNoticeType('error');
    } finally {
      setLoading(false);
    }
  }

  async function createRequest() {
    if (!result?.recommended_phc) return;
    setRequesting(true);
    try {
      const req = await requestsApi.create({
        medicine_id: Number(selectedMed),
        source_phc_id: Number(currentPhcId),
        destination_phc_id: result.recommended_phc.id,
        quantity: 10,
      });
      setNotice(`✅ Transfer request #${req.id} created successfully. Status: PENDING`);
      setNoticeType('success');
    } catch (err) {
      setNotice(err.message);
      setNoticeType('error');
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Package className="w-6 h-6 text-brand" />
        <h1 className="text-xl font-bold font-display">Medicine Availability</h1>
      </div>

      <Card>
        <CardHeader><p className="font-semibold text-gray-800">Search Medicine</p></CardHeader>
        <CardBody className="space-y-4">
          <Select
            label="Select Medicine"
            value={selectedMed}
            onChange={e => { setSelectedMed(e.target.value); setResult(null); }}
          >
            {medicines.map(m => <option key={m.id} value={m.id}>{m.name} ({m.category})</option>)}
          </Select>

          <Select
            label="Your PHC (Current Location)"
            value={currentPhcId}
            onChange={e => { setCurrentPhcId(Number(e.target.value)); setResult(null); }}
          >
            {phcs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>

          <Button onClick={checkAvailability} loading={loading} size="lg" className="w-full">
            <Search className="w-4 h-4" />
            Check Availability
          </Button>
        </CardBody>
      </Card>

      {notice && <Alert type={noticeType}>{notice}</Alert>}

      {result && (
        <Card>
          <CardHeader>
            <p className="font-semibold text-gray-800">{result.medicine}</p>
            <p className="text-xs text-gray-500 mt-0.5">Unit: {result.unit}</p>
          </CardHeader>
          <CardBody className="space-y-4">
            {/* Current PHC */}
            <div className={`rounded-xl p-4 ${result.current_phc_available ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Current PHC — {result.current_phc_name}</p>
              {result.current_phc_available ? (
                <p className="font-bold text-green-700">✅ Available — {result.current_quantity} {result.unit}</p>
              ) : (
                <p className="font-bold text-red-700">❌ Out of Stock</p>
              )}
            </div>

            {/* Nearby PHCs */}
            {result.nearby_phcs?.length > 0 ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-3">Nearby PHCs with Stock</p>
                  <div className="space-y-2">
                    {result.nearby_phcs.map((phc, i) => (
                      <div key={phc.id} className={`flex items-center justify-between p-3 rounded-xl border ${i === 0 ? 'border-brand bg-brand-muted' : 'border-gray-200 bg-gray-50'}`}>
                        <div>
                          <p className="font-semibold text-sm text-gray-900">
                            {i === 0 && <span className="text-brand mr-1">★ Recommended</span>}
                            {phc.name}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">{phc.distance_km} km away · {phc.available_quantity} {result.unit}</p>
                        </div>
                        <Badge variant={phc.status || 'AVAILABLE'}>{phc.status || 'AVAILABLE'}</Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI PHC Recommendation Explanation Card */}
                {aiRecLoading && (
                  <div className="p-3.5 bg-indigo-50/30 border border-indigo-100 rounded-xl text-xs text-indigo-700 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 animate-spin text-indigo-500" />
                    Generating recommendation explanation...
                  </div>
                )}
                {aiRecommendation && (
                  <div className="p-3.5 bg-indigo-50/20 border border-indigo-100 rounded-xl text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-indigo-800 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                        AI Recommendation Explanation
                      </p>
                      <VoiceAssistanceButton text={aiRecommendation.explanation} />
                    </div>
                    <p className="text-gray-700 leading-relaxed italic">
                      "{aiRecommendation.explanation}"
                    </p>
                  </div>
                )}

                {/* Create request */}
                {!result.current_phc_available && result.recommended_phc && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="font-semibold text-amber-800 mb-1">Medicine unavailable at your PHC</p>
                    <p className="text-sm text-amber-700 mb-3">
                      Create a transfer request from <strong>{result.recommended_phc.name}</strong> ({result.recommended_phc.distance_km} km) — {result.recommended_phc.available_quantity} units available.
                    </p>
                    <Button onClick={createRequest} loading={requesting}>
                      Create Transfer Request
                    </Button>
                    <p className="text-xs text-gray-500 mt-2 italic">
                      Note: This creates an authorized resupply request. PHC-Sync does not physically deliver medicines.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              !result.current_phc_available && (
                <Alert type="error">No nearby PHC currently has stock of this medicine.</Alert>
              )
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
