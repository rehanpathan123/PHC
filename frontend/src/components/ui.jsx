/** Shared UI component library for PHC-Sync */
import { Loader2 } from 'lucide-react';

// ── Badge ─────────────────────────────────────────────────────────────────────

export function Badge({ children, variant = 'default', className = '' }) {
  const variants = {
    default:  'bg-gray-100 text-gray-700',
    HIGH:     'bg-red-100 text-red-700',
    MEDIUM:   'bg-amber-100 text-amber-700',
    LOW:      'bg-green-100 text-green-700',
    AVAILABLE:'bg-emerald-100 text-emerald-700',
    LOW_STOCK:'bg-amber-100 text-amber-700',
    OUT_OF_STOCK: 'bg-red-100 text-red-700',
    PENDING:  'bg-blue-100 text-blue-700',
    APPROVED: 'bg-green-100 text-green-700',
    REJECTED: 'bg-red-100 text-red-700',
    COMPLETED:'bg-purple-100 text-purple-700',
    SYNCED:   'bg-emerald-100 text-emerald-700',
    FAILED:   'bg-red-100 text-red-700',
    SYNCING:  'bg-blue-100 text-blue-700',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${variants[variant] || variants.default} ${className}`}>
      {children}
    </span>
  );
}

// ── Button ────────────────────────────────────────────────────────────────────

export function Button({ children, variant = 'primary', size = 'md', loading, className = '', ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed';
  const variants = {
    primary:  'bg-brand hover:bg-brand-dark text-white focus:ring-brand',
    secondary:'bg-brand-muted hover:bg-teal-100 text-brand focus:ring-brand',
    danger:   'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
    ghost:    'bg-transparent hover:bg-gray-100 text-gray-600 focus:ring-gray-400',
    outline:  'border border-brand text-brand hover:bg-brand-muted focus:ring-brand',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

export function Card({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }) {
  return <div className={`px-6 py-4 border-b border-gray-100 ${className}`}>{children}</div>;
}

export function CardBody({ children, className = '' }) {
  return <div className={`px-6 py-4 ${className}`}>{children}</div>;
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

export function StatCard({ label, value, icon: Icon, color = 'teal' }) {
  const colors = {
    teal:   'text-brand bg-brand-muted',
    red:    'text-red-600 bg-red-50',
    amber:  'text-amber-600 bg-amber-50',
    green:  'text-green-600 bg-green-50',
    blue:   'text-blue-600 bg-blue-50',
    purple: 'text-purple-600 bg-purple-50',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-bold font-display text-gray-900 mt-0.5">{value ?? 0}</p>
      </div>
    </div>
  );
}

// ── Risk Card ─────────────────────────────────────────────────────────────────

export function RiskCard({ result }) {
  if (!result) return null;
  const styles = {
    HIGH:   { border: 'border-l-4 border-red-500 bg-red-50', badge: 'text-red-700 bg-red-100', icon: '🚨' },
    MEDIUM: { border: 'border-l-4 border-amber-500 bg-amber-50', badge: 'text-amber-700 bg-amber-100', icon: '⚠️' },
    LOW:    { border: 'border-l-4 border-green-500 bg-green-50', badge: 'text-green-700 bg-green-100', icon: '✅' },
  };
  const s = styles[result.risk_level] || styles.LOW;
  return (
    <div className={`rounded-xl p-5 mt-4 ${s.border}`}>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{s.icon}</span>
        <div>
          <span className={`font-bold text-lg ${s.badge.split(' ')[0]}`}>
            {result.risk_level} RISK
          </span>
          <span className="ml-2 text-sm text-gray-500">Score: {result.risk_score}/100</span>
        </div>
      </div>
      <p className="font-semibold text-gray-800 mb-2">{result.recommended_action}</p>
      {result.reasons?.length > 0 && (
        <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
          {result.reasons.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      )}
      <p className="text-xs text-gray-500 mt-3 italic">
        PHC-Sync provides preliminary decision support and does not replace professional medical diagnosis.
      </p>
    </div>
  );
}

// ── Loading Spinner ───────────────────────────────────────────────────────────

export function LoadingSpinner({ message = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-brand" />
      <p className="text-gray-500 text-sm">{message}</p>
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────

export function EmptyState({ title, description, icon: Icon }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
      {Icon && <Icon className="w-10 h-10 text-gray-300" />}
      <p className="font-semibold text-gray-600">{title}</p>
      {description && <p className="text-sm text-gray-400 max-w-sm">{description}</p>}
    </div>
  );
}

// ── Alert ─────────────────────────────────────────────────────────────────────

export function Alert({ type = 'info', children, className = '' }) {
  const styles = {
    info:    'bg-blue-50 text-blue-800 border-blue-200',
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    error:   'bg-red-50 text-red-800 border-red-200',
  };
  return (
    <div className={`rounded-lg border p-3 text-sm ${styles[type]} ${className}`}>
      {children}
    </div>
  );
}

// ── Input ─────────────────────────────────────────────────────────────────────

export function Input({ label, error, className = '', ...props }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && <label className="text-sm font-semibold text-gray-700">{label}</label>}
      <input
        className={`w-full px-3 py-2.5 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-colors ${
          error ? 'border-red-400' : 'border-gray-300'
        }`}
        {...props}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ── Select ────────────────────────────────────────────────────────────────────

export function Select({ label, error, className = '', children, ...props }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && <label className="text-sm font-semibold text-gray-700">{label}</label>}
      <select
        className={`w-full px-3 py-2.5 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-colors ${
          error ? 'border-red-400' : 'border-gray-300'
        }`}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────

export function Toast({ message, type = 'success', onClose }) {
  const styles = {
    success: 'bg-emerald-600 text-white',
    error:   'bg-red-600 text-white',
    info:    'bg-blue-600 text-white',
  };
  if (!message) return null;
  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg max-w-sm ${styles[type]}`}>
      <span className="text-sm font-medium flex-1">{message}</span>
      <button onClick={onClose} className="opacity-75 hover:opacity-100 text-lg leading-none">&times;</button>
    </div>
  );
}

// ── Online Indicator ──────────────────────────────────────────────────────────

export function OnlineIndicator({ online }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
      online ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
    }`}>
      <span className={`w-2 h-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
      {online ? 'Online' : 'Offline Mode'}
    </div>
  );
}
