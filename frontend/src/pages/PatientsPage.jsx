import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, PlusCircle, Search } from 'lucide-react';
import { patientsApi } from '../services/api';
import { Badge, Card, CardHeader, CardBody, Button, LoadingSpinner, EmptyState, Input } from '../components/ui';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function PatientsPage() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    patientsApi.list().then(setPatients).finally(() => setLoading(false));
  }, []);

  const filtered = patients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.patient_code?.toLowerCase().includes(search.toLowerCase()) ||
    p.village?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-brand" />
          <h1 className="text-xl font-bold font-display">Patients</h1>
          <span className="text-sm text-gray-500">{patients.length} total</span>
        </div>
        <Link to="/patients/new">
          <Button>
            <PlusCircle className="w-4 h-4" />
            Add Patient
          </Button>
        </Link>
      </div>

      <Input
        placeholder="Search by name, ID, or village…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <Card>
        {filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No patients found"
            description={search ? 'Try a different search term.' : 'Add your first patient using the button above.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Patient ID', 'Name', 'Age', 'Gender', 'Village', 'Risk', 'Date'].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.patient_code}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{p.name}</td>
                    <td className="px-4 py-3 text-gray-600">{p.age}</td>
                    <td className="px-4 py-3 text-gray-600">{p.gender}</td>
                    <td className="px-4 py-3 text-gray-600">{p.village}</td>
                    <td className="px-4 py-3">
                      {p.risk_level ? (
                        <Badge variant={p.risk_level}>{p.risk_level}</Badge>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
