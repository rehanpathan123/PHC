/**
 * i18n — simple translation lookup.
 * English is the default. Add Hindi or other languages by
 * adding a new locale object below and calling setLocale().
 */

const en = {
  app_name: 'PHC-Sync',
  app_tagline: 'Offline-First Primary Healthcare Decision Support',
  disclaimer: 'PHC-Sync provides preliminary decision support and does not replace professional medical diagnosis.',
  login: 'Sign In',
  logout: 'Logout',
  email: 'Email or Phone',
  password: 'Password',
  role: 'Role',
  demo_asha: 'ASHA Worker Demo',
  demo_officer: 'PHC Officer Demo',
  demo_admin: 'Admin Demo',
  demo_password: 'Demo password: Demo@123',
  online: 'Online',
  offline: 'Offline Mode',
  sync_now: 'Sync Now',
  pending_sync: 'Pending Sync',
  add_patient: 'Add Patient',
  risk_assessment: 'Risk Assessment',
  medicine_availability: 'Medicine Availability',
  nearby_phcs: 'Nearby PHCs',
  dashboard: 'Dashboard',
  patients: 'Patients',
  inventory: 'Inventory',
  requests: 'Requests',
  high_risk: 'High Risk',
  medium_risk: 'Medium Risk',
  low_risk: 'Low Risk',
  available: 'Available',
  low_stock: 'Low Stock',
  out_of_stock: 'Out of Stock',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  completed: 'Completed',
  approve: 'Approve',
  reject: 'Reject',
  create_request: 'Create Transfer Request',
  check_availability: 'Check Availability',
  save_assess: 'Save & Run Assessment',
  saving: 'Saving…',
};

let _locale = en;

export function t(key) {
  return _locale[key] || key;
}

export function setLocale(locale) {
  _locale = locale;
}
