export const OFFICIAL_BARANGAY_ADDRESS = 'Block 1, Sampaguita St, PCF 1, Cainta, 1900 Rizal';
export const OFFICIAL_PIO_EMAIL = 'pio.brgysanandres@gmail.com';

export const LABELS = {
  APP_NAME: 'San Andres Complaint System',
  ROLES: {
    mamamayan: 'Citizen',
    admin: 'Barangay Admin',
    official: 'Barangay Official'
  },
  STATUS: {
    bago: 'New',
    sinusuri: 'Under Review',
    'naka-assign': 'Assigned',
    iniimbestigahan: 'Under Investigation',
    'naka-iskedyul': 'Scheduled',
    'sa-mediation': 'In Mediation',
    natapos: 'Resolved',
    archived: 'Archived'
  },
  NAV: {
    dashboard: 'Dashboard',
    reklamo: 'Complaints',
    calendar: 'Calendar',
    chat: 'Chat',
    reports: 'Reports',
    settings: 'Settings',
    logout: 'Logout'
  },
  AUTH: {
    login: 'Login',
    register: 'Register',
    email: 'Email Address',
    password: 'Password',
    name: 'Full Name',
    no_account: "Don't have an account? Register here.",
    has_account: 'Already have an account? Login here.'
  },
  COMPLAINT: {
    submit: 'Submit Complaint',
    type: 'Complaint Type',
    details: 'Details',
    status: 'Status',
    date: 'Date',
    actions: 'Actions',
    reporter: 'Complainant',
    assigned: 'Assigned to'
  }
};

export const formatComplaintStatus = (status?: string | null): string => {
  if (!status) return '—';
  return (LABELS.STATUS as Record<string, string>)[status] || status;
};
