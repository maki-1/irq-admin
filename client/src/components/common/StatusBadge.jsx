const MAP = {
  Pending: 'status-pending',
  Submitted: 'status-processing',
  'Under Review': 'status-processing',
  Processing: 'status-processing',
  Printing: 'status-processing',
  Ready: 'status-ready',
  Rejected: 'status-rejected',
  Claimed: 'status-claimed',
};

export default function StatusBadge({ status }) {
  return <span className={MAP[status] || 'status-pending'}>{status || '—'}</span>;
}
