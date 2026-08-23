import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, User, Calendar, MapPin, Phone, Sparkles } from 'lucide-react';
import { patientsApi, inventoryApi, aiApi } from '../services/api';
import { saveOfflinePatient } from '../offline/db';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import {
  Button, Input, Select, Card, CardHeader, CardBody,
  RiskCard, Alert, Badge
} from '../components/ui';
import VoiceInput from '../components/VoiceInput';
import VoiceAssistanceButton from '../components/VoiceAssistanceButton';

/** Local risk mirror (same logic as backend, for offline use). */
function localRisk(data) {
  const sy = (data.symptoms || []).map(s => s.toLowerCase());
  let score = 0;
  const reasons = [];

  if (data.spo2 !== undefined && data.spo2 !== null && data.spo2 < 90) {
    score = Math.max(score, 85);
    reasons.push(`Critical oxygen saturation (SpO₂ ${data.spo2}%)`);
  }
  if (sy.some(s => s.includes('unconscious') || s.includes('chest pain'))) {
    score = Math.max(score, 90);
    reasons.push('Emergency symptom reported');
  }
  if (sy.some(s => s.includes('breathing') || s.includes('breath'))) {
    score = Math.max(score, 80);
    reasons.push('Breathing difficulty reported');
  }
  if (data.temperature >= 39) {
    score = Math.max(score, 60);
    reasons.push(`High fever (${data.temperature}°C)`);
  }
  if (sy.some(s => ['fever', 'weakness', 'cough', 'cold'].some(k => s.includes(k)))) {
    score = Math.max(score, 30);
    reasons.push('Mild symptoms present');
  }

  const level = score >= 70 ? 'HIGH' : score >= 35 ? 'MEDIUM' : 'LOW';
  return {
    risk_level: level,
    risk_score: score,
    reasons: reasons.length ? reasons : ['No major warning signs from reported vitals'],
    recommended_action:
      level === 'HIGH' ? 'Urgent clinical evaluation required.'
      : level === 'MEDIUM' ? 'Clinical review recommended within 24 hours.'
      : 'Monitor symptoms; seek care if they worsen.',
  };
}

const SYMPTOM_OPTIONS = [
  'Fever', 'Breathing difficulty', 'Weakness',
  'Persistent cough', 'Severe chest pain', 'Unconsciousness',
  'Vomiting', 'Diarrhoea', 'Headache', 'Cold / Runny nose',
];

const EXISTING_CONDITIONS = ['Diabetes', 'Hypertension', 'Asthma', 'Tuberculosis', 'Heart disease', 'Pregnancy'];

export default function AddPatientPage() {
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [aiSummary, setAiSummary] = useState('');
  const [aiExplanation, setAiExplanation] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [medicines, setMedicines] = useState([]);

  const [form, setForm] = useState({
    name: '', age: '', gender: 'Female', village: '', phone: '',
    existing_conditions: '',
    symptoms: [], temperature: '', heart_rate: '', spo2: '',
    blood_pressure: '', required_medicine: '', notes: '',
  });

  useEffect(() => {
    inventoryApi.getAllMedicines().then(setMedicines).catch(() => {});
  }, []);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function toggleSymptom(s) {
    set('symptoms', form.symptoms.includes(s)
      ? form.symptoms.filter(x => x !== s)
      : [...form.symptoms, s]);
  }

  function handleVoiceExtracted(data) {
    // Populate form symptoms based on boolean flags
    const extracted = [];
    if (data.fever) extracted.push('Fever');
    if (data.breathing_difficulty) extracted.push('Breathing difficulty');
    if (data.cough) extracted.push('Persistent cough');
    if (data.chest_pain) extracted.push('Severe chest pain');
    if (data.weakness) extracted.push('Weakness');
    if (data.vomiting) extracted.push('Vomiting');
    
    // Add other custom symptoms to notes
    let notes = form.notes;
    if (data.other_symptoms && data.other_symptoms.length > 0) {
      const otherStr = `Other symptoms: ${data.other_symptoms.join(', ')}`;
      notes = notes ? `${notes}\n${otherStr}` : otherStr;
    }

    setForm(f => ({
      ...f,
      symptoms: [...new Set([...f.symptoms, ...extracted])],
      notes: notes,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setNotice('');
    setResult(null);
    setAiSummary('');
    setAiExplanation(null);

    const payload = {
      ...form,
      age: Number(form.age),
      temperature: form.temperature ? Number(form.temperature) : null,
      heart_rate: form.heart_rate ? Number(form.heart_rate) : null,
      spo2: form.spo2 ? Number(form.spo2) : null,
      required_medicine: form.required_medicine || null,
      notes: form.notes || null,
    };

    try {
      let activeResult = null;
      if (!online) {
        activeResult = localRisk(payload);
        await saveOfflinePatient(payload);
        setResult(activeResult);
        setNotice('📱 Saved locally — will sync when internet returns.');
      } else {
        const data = await patientsApi.create(payload);
        activeResult = data.assessment;
        setResult(activeResult);
        setNotice('✅ Patient registered successfully.');
      }

      // If online and we got a result, query the AI Summary and AI Risk Explanation
      if (online && activeResult) {
        setAiLoading(true);
        try {
          const summaryReq = {
            age: payload.age,
            symptoms: payload.symptoms,
            temperature: payload.temperature,
            spo2: payload.spo2,
            heart_rate: payload.heart_rate,
            risk_level: activeResult.risk_level,
          };
          const explReq = {
            risk_level: activeResult.risk_level,
            risk_score: activeResult.risk_score,
            reasons: activeResult.reasons,
            age: payload.age,
            symptoms: payload.symptoms,
          };

          const [summaryData, explData] = await Promise.all([
            aiApi.patientSummary(summaryReq),
            aiApi.riskExplanation(explReq)
          ]);

          setAiSummary(summaryData.summary);
          setAiExplanation(explData);
        } catch (aiErr) {
          console.error('Failed to load AI explanations: ', aiErr);
        } finally {
          setAiLoading(false);
        }
      }
    } catch (err) {
      setNotice(`❌ ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <PlusCircle className="w-6 h-6 text-brand" />
        <h1 className="text-xl font-bold font-display">Register Patient & Risk Assessment</h1>
      </div>

      {!online && (
        <Alert type="warning">
          📴 You are offline. Patient data will be saved locally and synced when internet returns.
        </Alert>
      )}

      {notice && (
        <Alert type={notice.startsWith('❌') ? 'error' : notice.startsWith('⚠') ? 'warning' : 'success'}>
          {notice}
        </Alert>
      )}

      {/* Result Card */}
      {result && (
        <div className="space-y-4">
          <RiskCard result={result} />

          {/* AI Clinical Summary (visually separate) */}
          {aiLoading && (
            <Card className="border-indigo-100 bg-indigo-50/30">
              <CardBody className="py-4 text-sm text-indigo-700 flex items-center gap-2">
                <Sparkles className="w-4 h-4 animate-spin" />
                Generating professional AI summary...
              </CardBody>
            </Card>
          )}

          {aiSummary && (
            <Card className="border-indigo-100 bg-indigo-50/20">
              <CardHeader className="py-3 bg-indigo-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span className="font-semibold text-sm text-indigo-800">AI Patient Summary</span>
                </div>
                <VoiceAssistanceButton text={aiSummary} />
              </CardHeader>
              <CardBody className="text-sm text-gray-700 leading-relaxed">
                {aiSummary}
              </CardBody>
            </Card>
          )}

          {/* AI Risk Explanation (visually separate) */}
          {aiExplanation && aiExplanation.explanation && (
            <Card className="border-indigo-100 bg-indigo-50/20">
              <CardHeader className="py-3 bg-indigo-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span className="font-semibold text-sm text-indigo-800">AI Risk Explanation</span>
                </div>
                <VoiceAssistanceButton text={aiExplanation.explanation.join('. ')} />
              </CardHeader>
              <CardBody className="text-sm text-gray-700 space-y-2">
                <p className="font-medium text-gray-900">
                  Recommended Urgency: <Badge variant={result.risk_level}>{aiExplanation.recommended_urgency}</Badge>
                </p>
                <ul className="list-disc list-inside space-y-1">
                  {aiExplanation.explanation.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}

          <div className="mt-4 flex gap-2">
            <Button onClick={() => { setResult(null); setAiSummary(''); setAiExplanation(null); }} variant="secondary" size="sm">
              Add Another Patient
            </Button>
            <Button onClick={() => navigate('/medicine')} size="sm">
              Check Medicine Availability →
            </Button>
          </div>
        </div>
      )}

      {!result && (
        <div className="space-y-6">
          {/* Voice symptom intake */}
          {online && (
            <VoiceInput onSymptomsExtracted={handleVoiceExtracted} />
          )}

          <Card>
            <CardHeader>
              <p className="text-sm text-gray-500">Only collect information needed for preliminary support.</p>
            </CardHeader>
            <CardBody>
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Demographics */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input label="Full Name *" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Patient name" required />
                  <Input label="Age *" type="number" min="0" max="120" value={form.age} onChange={e => set('age', e.target.value)} placeholder="Years" required />
                  <Select label="Gender *" value={form.gender} onChange={e => set('gender', e.target.value)}>
                    <option>Female</option>
                    <option>Male</option>
                    <option>Other</option>
                  </Select>
                  <Input label="Village *" value={form.village} onChange={e => set('village', e.target.value)} placeholder="Village name" required />
                  <Input label="Phone" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="Optional" />
                </div>

                {/* Vitals */}
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-3">Vitals</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <Input label="Temp (°C)" type="number" step="0.1" min="35" max="42" value={form.temperature} onChange={e => set('temperature', e.target.value)} placeholder="e.g. 38.5" />
                    <Input label="Heart Rate" type="number" min="30" max="200" value={form.heart_rate} onChange={e => set('heart_rate', e.target.value)} placeholder="bpm" />
                    <Input label="SpO₂ %" type="number" min="70" max="100" value={form.spo2} onChange={e => set('spo2', e.target.value)} placeholder="e.g. 96" />
                    <Input label="Blood Pressure" value={form.blood_pressure} onChange={e => set('blood_pressure', e.target.value)} placeholder="120/80" />
                  </div>
                </div>

                {/* Symptoms */}
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-3">Symptoms (select all that apply)</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {SYMPTOM_OPTIONS.map(s => (
                      <label key={s} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-gray-200 cursor-pointer hover:bg-brand-muted transition-colors">
                        <input
                          type="checkbox"
                          checked={form.symptoms.includes(s)}
                          onChange={() => toggleSymptom(s)}
                          className="w-4 h-4 text-brand rounded"
                        />
                        <span className="text-sm">{s}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Required Medicine */}
                <Select label="Required Medicine (if known)" value={form.required_medicine} onChange={e => set('required_medicine', e.target.value)}>
                  <option value="">— Select if needed —</option>
                  {medicines.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                </Select>

                {/* Notes */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold text-gray-700">Notes</label>
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={e => set('notes', e.target.value)}
                    placeholder="Additional observations…"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand resize-none"
                  />
                </div>

                <Button type="submit" loading={saving} size="lg" className="w-full">
                  {online ? 'Save & Run Risk Assessment' : 'Save Offline & Run Assessment'}
                </Button>
              </form>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
