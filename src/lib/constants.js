// Labels and color mappings for enums - keep in sync with SQL types
export const CHURCH_NAME = import.meta.env.VITE_CHURCH_NAME || 'Nyacaba';

export const CONTRIBUTION_TYPES = [
  { value: 'monthly',  label: 'Monthly Contribution' },
  { value: 'tithe',    label: 'Tithe' },
  { value: 'offering', label: 'Offering' },
  { value: 'pledge',   label: 'Pledge Payment' },
  { value: 'project',  label: 'Project Contribution' },
  { value: 'special',  label: 'Special / Other' },
];

export const PAYMENT_METHODS = [
  { value: 'cash',   label: 'Cash' },
  { value: 'mpesa',  label: 'M-Pesa' },
  { value: 'bank',   label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other',  label: 'Other' },
];

export const PLEDGE_STATUS = {
  open:      { label: 'Open',      className: 'badge-amber' },
  partial:   { label: 'Partial',   className: 'badge-blue' },
  fulfilled: { label: 'Fulfilled', className: 'badge-emerald' },
  cancelled: { label: 'Cancelled', className: 'badge-slate' },
};

export const WELFARE_CATEGORIES = [
  { value: 'hospital',     label: 'Hospital / Medical' },
  { value: 'rent',         label: 'Rent Support' },
  { value: 'food',         label: 'Food Assistance' },
  { value: 'electricity',  label: 'Electricity Tokens' },
  { value: 'burial',       label: 'Burial / Funeral' },
  { value: 'school_fees',  label: 'School Fees' },
  { value: 'emergency',    label: 'Emergency' },
  { value: 'other',        label: 'Other' },
];

export const WELFARE_STATUS = {
  pending:      { label: 'Pending',      className: 'badge-amber' },
  under_review: { label: 'Under Review', className: 'badge-blue' },
  approved:     { label: 'Approved',     className: 'badge-emerald' },
  rejected:     { label: 'Rejected',     className: 'badge-rose' },
  disbursed:    { label: 'Disbursed',    className: 'badge-gold' },
  closed:       { label: 'Closed',       className: 'badge-slate' },
};

export const PROJECT_STATUS = {
  planning:  { label: 'Planning',  className: 'badge-blue' },
  active:    { label: 'Active',    className: 'badge-emerald' },
  on_hold:   { label: 'On Hold',   className: 'badge-amber' },
  completed: { label: 'Completed', className: 'badge-gold' },
  cancelled: { label: 'Cancelled', className: 'badge-slate' },
};

export const MEETING_STATUS = {
  scheduled:   { label: 'Scheduled',   className: 'badge-blue' },
  in_progress: { label: 'In Progress', className: 'badge-emerald' },
  completed:   { label: 'Completed',   className: 'badge-slate' },
  cancelled:   { label: 'Cancelled',   className: 'badge-rose' },
};

export const RESOLUTION_STATUS = {
  proposed: { label: 'Proposed', className: 'badge-blue' },
  voting:   { label: 'Voting',   className: 'badge-amber' },
  passed:   { label: 'Passed',   className: 'badge-emerald' },
  rejected: { label: 'Rejected', className: 'badge-rose' },
  tabled:   { label: 'Tabled',   className: 'badge-slate' },
};

export const ITEM_CONDITION = [
  { value: 'new',     label: 'New' },
  { value: 'good',    label: 'Good' },
  { value: 'fair',    label: 'Fair' },
  { value: 'poor',    label: 'Poor' },
  { value: 'damaged', label: 'Damaged' },
];

export const TXN_TYPES = [
  { value: 'intake',     label: 'Intake / Receive' },
  { value: 'donation',   label: 'Donation In' },
  { value: 'purchase',   label: 'Purchase' },
  { value: 'issue',      label: 'Issue / Use' },
  { value: 'disposal',   label: 'Disposal' },
  { value: 'adjustment', label: 'Adjustment' },
];

export const URGENCY = [
  { value: 'low',      label: 'Low' },
  { value: 'medium',   label: 'Medium' },
  { value: 'high',     label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

export const ROLES = [
  { value: 'admin',         label: 'Administrator', short: 'Admin',    className: 'badge-gold'    },
  { value: 'chairperson',   label: 'Chairperson',   short: 'Chair',    className: 'badge-emerald' },
  { value: 'treasurer',     label: 'Treasurer',     short: 'Treasurer',className: 'badge-blue'    },
  { value: 'welfare_chair', label: 'Welfare Chair', short: 'Welfare',  className: 'badge-amber'   },
  { value: 'member',        label: 'Member',        short: 'Member',   className: 'badge-slate'   },
];

export function roleLabel(role) {
  return ROLES.find(r => r.value === role)?.label || role || '—';
}

export function roleBadgeClass(role) {
  return ROLES.find(r => r.value === role)?.className || 'badge-slate';
}

export const VERIFICATION_STATUS = {
  pending:   { label: 'Pending verification', className: 'badge-amber',   icon: '⏳' },
  confirmed: { label: 'Confirmed',            className: 'badge-emerald', icon: '✓'  },
  rejected:  { label: 'Rejected',             className: 'badge-rose',    icon: '✗'  },
};
