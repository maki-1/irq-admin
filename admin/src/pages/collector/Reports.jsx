import { useEffect, useState } from 'react';
import { getRequests } from '../../services/request.service';
import CollectorLayout from '../../components/layouts/CollectorLayout';
import FinancialReport from '../../components/reports/FinancialReport';
import { GREEN, PrintStyle } from '../../components/reports/reportKit';

export default function CollectorReports() {
  const [requests, setRequests] = useState([]);
  const [loading,  setLoading]  = useState(true);

  const [fromDate, setFromDate] = useState('');
  const [toDate,   setToDate]   = useState('');

  useEffect(() => {
    getRequests()
      .then((r) => setRequests(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <CollectorLayout title="FINANCIAL REPORTS">
      <PrintStyle />

      <div className="flex flex-col gap-4">
        {/* ── date filter ── */}
        <div className="bg-white rounded-3xl p-5 no-print" style={{ boxShadow: '0 4px 4px rgba(0,0,0,0.15)' }}>
          <div className="grid grid-cols-2 gap-3">
            {[['From', fromDate, setFromDate], ['To', toDate, setToDate]].map(([lbl, val, set]) => (
              <div key={lbl}>
                <label style={{ fontFamily: "'Kaisei Decol',serif", color: '#827575', fontSize: 12, display: 'block', marginBottom: 4 }}>{lbl}</label>
                <input type="date" value={val} onChange={(e) => set(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
                  style={{ fontFamily: "'Hanken Grotesk',sans-serif", background: '#F9F7F7', border: '1px solid #E8E0E0', color: '#333' }} />
              </div>
            ))}
          </div>
          {(fromDate || toDate) && (
            <button onClick={() => { setFromDate(''); setToDate(''); }}
              className="mt-3 text-xs" style={{ fontFamily: "'Hanken Grotesk',sans-serif", color: GREEN }}>
              Clear date range
            </button>
          )}
        </div>

        {loading
          ? <p className="text-center py-16" style={{ fontFamily: "'Kaisei Decol',serif", color: '#C0B0B0' }}>Loading financial data…</p>
          : <FinancialReport requests={requests} from={fromDate} to={toDate} />}
      </div>
    </CollectorLayout>
  );
}
