import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, ShieldAlert, Activity, CheckCircle, Package,
  FileText, RefreshCw, PlusCircle, Map, Wifi, WifiOff, Sparkles, TrendingUp
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer, Legend
} from 'recharts';
import { dashboardApi, syncApi, aiApi, inventoryApi } from '../services/api';
import { syncPendingRecords, getPendingCount } from '../offline/db';
import { useAuth } from '../context/AuthContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { StatCard, Card, CardHeader, CardBody, Button, Badge, LoadingSpinner, Select } from '../components/ui';
import AIStatusBadge from '../components/AIStatusBadge';
import AICopilot from '../components/AICopilot';
import VoiceAssistanceButton from '../components/VoiceAssistanceButton';

const RISK_COLORS = { HIGH: '#dc2626', MEDIUM: '#d97706', LOW: '#16a34a' };

export default function DashboardPage() {
  const { user } = useAuth();
  const online = useOnlineStatus();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncMsg, setSyncMsg] = useState('');
  const [lastSync, setLastSync] = useState(localStorage.getItem('phc_last_sync') || null);

  // AI Intelligence states
  const [stockoutAlerts, setStockoutAlerts] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [forecastMedId, setForecastMedId] = useState('');
  const [forecastResult, setForecastResult] = useState(null);
  const [forecastLoading, setForecastLoading] = useState(false);

  async function loadStats() {
    try {
      const data = await dashboardApi.stats();
      setStats(data);
    } catch (_) {}
    setLoading(false);
  }

  async function loadPending() {
    const count = await getPendingCount();
    setPendingCount(count);
  }

  async function loadAIIntelligence() {
    if (user?.role === 'OFFICER' || user?.role === 'ADMIN') {
      try {
        const phcId = user.phc_id || 1;
        const [alerts, anoms, meds] = await Promise.all([
          aiApi.stockoutAlerts(phcId),
          aiApi.anomalies(phcId),
          inventoryApi.getAllMedicines(),
        ]);
        setStockoutAlerts(alerts);
        setAnomalies(anoms);
        setMedicines(meds);
        if (meds.length > 0) {
          setForecastMedId(String(meds[0].id));
        }
      } catch (err) {
        console.error('Failed to load AI Intelligence data:', err);
      }
    }
  }

  useEffect(() => {
    loadStats();
    loadPending();
    loadAIIntelligence();
  }, []);

  async function handleSync() {
    if (!online) { setSyncMsg('Connect to the internet first.'); return; }
    setSyncing(true);
    setSyncMsg('');
    try {
      const { synced, failed } = await syncPendingRecords(syncApi.push);
      const now = new Date().toLocaleTimeString();
      setLastSync(now);
      localStorage.setItem('phc_last_sync', now);
      if (synced > 0) {
        setSyncMsg(`✅ ${synced} record(s) synchronized successfully.`);
      } else if (failed > 0) {
        setSyncMsg(`⚠️ ${failed} record(s) failed to sync. Will retry.`);
      } else {
        setSyncMsg('No pending records to sync.');
      }
      await loadPending();
      await loadStats();
    } catch (err) {
      setSyncMsg('Sync failed. Records remain safe locally.');
    } finally {
      setSyncing(false);
    }
  }

  async function getForecast() {
    if (!forecastMedId) return;
    setForecastLoading(true);
    setForecastResult(null);
    try {
      const phcId = user.phc_id || 1;
      const data = await aiApi.demandForecast(phcId, Number(forecastMedId));
      setForecastResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setForecastLoading(false);
    }
  }

  if (loading) return <LoadingSpinner message="Loading dashboard…" />;

  const risk = stats?.risk || {};
  const riskData = [
    { name: 'HIGH', value: risk.HIGH || 0 },
    { name: 'MEDIUM', value: risk.MEDIUM || 0 },
    { name: 'LOW', value: risk.LOW || 0 },
  ];
  const reqData = Object.entries(stats?.requests || {}).map(([status, count]) => ({ name: status, value: count }));

  const showAIIntelligence = user?.role === 'OFFICER' || user?.role === 'ADMIN';

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-gradient-to-r from-brand-dark to-brand rounded-2xl p-6 text-white shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-teal-200 text-xs font-semibold tracking-widest uppercase">Primary Healthcare Decision Support</p>
            <h1 className="text-2xl font-bold font-display mt-1">Welcome, {user?.name?.split(' ')[0]}</h1>
            <p className="text-teal-100 text-sm mt-1">Role: {user?.role} {lastSync && `· Last sync: ${lastSync}`}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <AIStatusBadge />
            <Button
              variant="ghost"
              onClick={handleSync}
              loading={syncing}
              className="bg-white/20 hover:bg-white/30 text-white border-0"
            >
              <RefreshCw className="w-4 h-4" />
              Sync Now
            </Button>
          </div>
        </div>
        {syncMsg && (
          <div className="mt-3 text-sm bg-white/20 rounded-lg px-3 py-2">{syncMsg}</div>
        )}
      </div>

      {/* Offline pending notice */}
      {pendingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-amber-800">📤 {pendingCount} record(s) pending sync</p>
            <p className="text-amber-600 text-sm">These records are safely stored locally.</p>
          </div>
          <Button onClick={handleSync} loading={syncing} size="sm" variant="outline" className="border-amber-400 text-amber-700 hover:bg-amber-100 whitespace-nowrap">
            Sync Now
          </Button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 items-center">
        <StatCard label="Total Patients" value={stats?.total_patients} icon={Users} color="teal" />
        <StatCard label="High Risk" value={risk.HIGH} icon={ShieldAlert} color="red" />
        <StatCard label="Medium Risk" value={risk.MEDIUM} icon={Activity} color="amber" />
        <StatCard label="Low Risk" value={risk.LOW} icon={CheckCircle} color="green" />
        <div className="flex flex-col items-center justify-center p-4 bg-gray-50 border border-gray-100 rounded-xl space-y-2">
          <span className="text-xs text-gray-500 font-medium">Read Stats</span>
          <VoiceAssistanceButton text={`Primary Health Centre statistics. Total registered patients: ${stats?.total_patients}. High risk assessments: ${risk.HIGH}. Medium risk assessments: ${risk.MEDIUM}. Low risk assessments: ${risk.LOW}.`} />
        </div>
      </div>

      {/* AI Health Intelligence Section */}
      {showAIIntelligence && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* AI Stockout Alerts */}
          <Card className="lg:col-span-1">
            <CardHeader className="flex items-center justify-between py-3 bg-red-50/50">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4.5 h-4.5 text-red-600" />
                <span className="font-semibold text-sm text-red-800">AI Stockout Risk Alerts</span>
              </div>
              {stockoutAlerts.length > 0 && (
                <VoiceAssistanceButton text={`AI stockout risk alerts: ${stockoutAlerts.map(a => `${a.medicine} has a ${a.risk} risk with current stock of ${a.current_stock}`).join('. ')}`} />
              )}
            </CardHeader>
            <CardBody className="divide-y divide-gray-100 max-h-[300px] overflow-y-auto">
              {stockoutAlerts.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">All medicine stocks stable.</p>
              ) : (
                stockoutAlerts.map((alert, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between text-sm">
                    <div>
                      <p className="font-semibold text-gray-900">{alert.medicine}</p>
                      <p className="text-xs text-gray-500">Current Stock: {alert.current_stock} · 7d demand: {alert.predicted_demand}</p>
                    </div>
                    <Badge variant={alert.risk}>{alert.risk} RISK</Badge>
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          {/* AI Forecast Simulator */}
          <Card className="lg:col-span-1">
            <CardHeader className="flex items-center justify-between py-3 bg-indigo-50/50">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4.5 h-4.5 text-indigo-600" />
                <span className="font-semibold text-sm text-indigo-800">AI Demand Forecast Sandbox</span>
              </div>
              {forecastResult && (
                <VoiceAssistanceButton text={forecastResult.explanation} />
              )}
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="flex gap-2">
                <Select
                  value={forecastMedId}
                  onChange={(e) => setForecastMedId(e.target.value)}
                  className="flex-1 py-1.5"
                >
                  {medicines.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </Select>
                <Button onClick={getForecast} loading={forecastLoading} size="sm">
                  AI Forecast
                </Button>
              </div>

              {forecastResult && (
                <div className="bg-indigo-50/20 border border-indigo-100 rounded-xl p-3 text-xs space-y-2">
                  <div className="flex justify-between font-semibold">
                    <span>Stock: {forecastResult.current_stock}</span>
                    <span>Reorder Qty: {forecastResult.recommended_reorder_quantity}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>7d forecast: {forecastResult.predicted_7_day_demand}</span>
                    <span>14d forecast: {forecastResult.predicted_14_day_demand}</span>
                  </div>
                  <p className="text-gray-700 mt-1 italic">"{forecastResult.explanation}"</p>
                </div>
              )}
            </CardBody>
          </Card>

          {/* AI Inventory Anomalies */}
          <Card className="lg:col-span-1">
            <CardHeader className="flex items-center justify-between py-3 bg-amber-50/50">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4.5 h-4.5 text-amber-600 animate-pulse" />
                <span className="font-semibold text-sm text-amber-800">AI Inventory Anomalies</span>
              </div>
              {anomalies.length > 0 && (
                <VoiceAssistanceButton text={`AI inventory anomalies detected: ${anomalies.map(a => `${a.medicine} shows observed usage of ${a.observed_usage} units, normal range ${a.normal_range}`).join('. ')}`} />
              )}
            </CardHeader>
            <CardBody className="divide-y divide-gray-100 max-h-[300px] overflow-y-auto">
              {anomalies.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">No usage anomalies detected.</p>
              ) : (
                anomalies.map((anom, idx) => (
                  <div key={idx} className="py-2.5 space-y-1 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-gray-900">{anom.medicine}</span>
                      <Badge variant="MEDIUM">{anom.severity} Alert</Badge>
                    </div>
                    <p className="text-gray-500">Observed: {anom.observed_usage} units (normal range: {anom.normal_range})</p>
                    <p className="text-amber-800 italic mt-0.5">"{anom.explanation}"</p>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {/* Charts & AI Copilot side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><p className="font-semibold text-gray-800">Risk Distribution</p></CardHeader>
              <CardBody>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={riskData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({name, value}) => `${name}: ${value}`}>
                      {riskData.map((entry) => (
                        <Cell key={entry.name} fill={RISK_COLORS[entry.name]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>

            <Card>
              <CardHeader><p className="font-semibold text-gray-800">Request Status</p></CardHeader>
              <CardBody>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={reqData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#087B75" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="PHCs" value={stats?.total_phcs} icon={Map} color="teal" />
            <StatCard label="Low Stock Items" value={stats?.inventory?.low_stock} icon={Package} color="amber" />
            <StatCard label="Medicine Requests" value={Object.values(stats?.requests || {}).reduce((a,b) => a+b, 0)} icon={FileText} color="blue" />
            <StatCard label="Pending Requests" value={stats?.pending_requests} icon={FileText} color="amber" />
          </div>
        </div>

        {/* AI Copilot on the side */}
        {(user?.role === 'OFFICER' || user?.role === 'ADMIN') && (
          <div className="lg:col-span-1">
            <AICopilot />
          </div>
        )}
      </div>

      {/* Quick Actions */}
      {user?.role === 'ASHA' && (
        <Card>
          <CardHeader><p className="font-semibold text-gray-800">Quick Actions</p></CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { to: '/patients/new', label: 'Add Patient', icon: PlusCircle },
                { to: '/medicine', label: 'Medicine Search', icon: Package },
                { to: '/map', label: 'Nearby PHCs', icon: Map },
                { to: '/requests', label: 'My Requests', icon: FileText },
                { to: '/offline', label: 'Offline Records', icon: RefreshCw },
              ].map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-brand hover:bg-brand-muted transition-colors group"
                >
                  <Icon className="w-5 h-5 text-brand" />
                  <span className="font-medium text-sm text-gray-700 group-hover:text-brand">{label}</span>
                </Link>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
