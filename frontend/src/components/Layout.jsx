import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Activity, LogOut, Menu, X,
  LayoutDashboard, Users, Package, FileText,
  Map, RefreshCw, Bell
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { OnlineIndicator } from './ui';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useI18n } from '../context/I18nContext';
import GlobalVoiceAssistant from './GlobalVoiceAssistant';

function navItems(role) {
  const asha = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/patients', label: 'Patients', icon: Users },
    { to: '/medicine', label: 'Medicine', icon: Package },
    { to: '/map', label: 'Nearby PHCs', icon: Map },
    { to: '/requests', label: 'Requests', icon: FileText },
    { to: '/offline', label: 'Offline', icon: RefreshCw },
  ];
  const officer = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/patients', label: 'Patients', icon: Users },
    { to: '/inventory', label: 'Inventory', icon: Package },
    { to: '/requests', label: 'Requests', icon: FileText },
    { to: '/map', label: 'Map', icon: Map },
  ];
  const admin = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/patients', label: 'Patients', icon: Users },
    { to: '/inventory', label: 'Inventory', icon: Package },
    { to: '/requests', label: 'Requests', icon: FileText },
    { to: '/map', label: 'Map', icon: Map },
  ];
  return role === 'ASHA' ? asha : role === 'OFFICER' ? officer : admin;
}

export function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const online = useOnlineStatus();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const { locale, changeLanguage, t } = useI18n();
  const items = navItems(user?.role);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-2 font-display font-bold text-brand text-xl">
            <Activity className="w-6 h-6" />
            <span className="hidden sm:block">PHC-Sync</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 ml-4">
            {items.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === to
                    ? 'bg-brand-muted text-brand'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <select
              value={locale}
              onChange={(e) => changeLanguage(e.target.value)}
              className="hidden sm:block text-sm border-gray-300 rounded-md bg-gray-50 focus:ring-brand focus:border-brand py-1 px-2"
            >
              <option value="en">English</option>
              <option value="hi">हिंदी</option>
              <option value="mr">मराठी</option>
            </select>
            <OnlineIndicator online={online} />
            <span className="hidden sm:block text-sm text-gray-500">{user?.name} · <span className="text-brand font-medium">{t(user?.role?.toLowerCase() === 'asha' ? 'role' : 'role') /* just a placeholder for role */}</span></span>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors px-2 py-1.5 rounded-lg hover:bg-red-50"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:block">Logout</span>
            </button>
            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-1">
            {items.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === to
                    ? 'bg-brand-muted text-brand'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
          </div>
        )}
      </header>

      {/* Main */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {children}
      </main>

      {/* Global Voice Assistant */}
      <GlobalVoiceAssistant />
    </div>
  );
}
