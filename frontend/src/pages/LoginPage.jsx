import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Activity, Stethoscope } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button, Input, Alert } from '../components/ui';

const DEMO_USERS = [
  { label: 'ASHA Worker', email: 'asha@phcsync.demo', role: 'ASHA' },
  { label: 'PHC Officer', email: 'officer@phcsync.demo', role: 'OFFICER' },
  { label: 'Admin', email: 'admin@phcsync.demo', role: 'ADMIN' },
];

export default function LoginPage() {
  const { user, login, loading } = useAuth();
  const [email, setEmail] = useState('asha@phcsync.demo');
  const [password, setPassword] = useState('Demo@123');
  const [error, setError] = useState('');

  if (user) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
    }
  }

  function fillDemo(demoEmail) {
    setEmail(demoEmail);
    setPassword('Demo@123');
    setError('');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand rounded-2xl mb-4 shadow-lg">
            <Activity className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold font-display text-gray-900">PHC-Sync</h1>
          <p className="text-gray-500 mt-1 text-sm">Offline-First Primary Healthcare Decision Support</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-6">Sign in to your account</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="email"
              label="Email or Phone"
              type="text"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="asha@phcsync.demo"
              required
            />
            <Input
              id="password"
              label="Password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            {error && <Alert type="error">{error}</Alert>}
            <Button type="submit" loading={loading} className="w-full" size="lg">
              Sign In Securely
            </Button>
          </form>

          {/* Demo logins */}
          <div className="mt-6">
            <p className="text-xs text-center text-gray-400 mb-3">Quick demo login</p>
            <div className="grid grid-cols-3 gap-2">
              {DEMO_USERS.map(({ label, email: demoEmail }) => (
                <button
                  key={demoEmail}
                  type="button"
                  onClick={() => fillDemo(demoEmail)}
                  className="px-2 py-2 text-xs font-medium text-brand bg-brand-muted rounded-lg hover:bg-teal-100 transition-colors text-center leading-tight"
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-center text-gray-400 mt-3">Demo password: <strong>Demo@123</strong></p>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-xs text-center text-gray-400 mt-4 max-w-sm mx-auto">
          PHC-Sync provides preliminary decision support only. It does not replace professional medical diagnosis.
        </p>
      </div>
    </div>
  );
}
