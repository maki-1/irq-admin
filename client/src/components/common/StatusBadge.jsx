const MAP = {
  Pending: 'status-pending',
  Processing: 'status-processing',
  Ready: 'status-ready',
  Rejected: 'status-rejected',
  Claimed: 'status-claimed',
};

export default function StatusBadge({ status }) {
  return <span className={MAP[status] || 'status-pending'}>{status}</span>;
}
