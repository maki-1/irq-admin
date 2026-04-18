import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import AppLayout from '../../components/layouts/AppLayout';
import { getDocuments, updatePayment } from '../../services/document.service';

export default function CollectorDashboard() {
  const [docs, setDocs] = useState([]);

  const fetchDocs = () => getDocuments().then((r) => setDocs(r.data));
  useEffect(() => { fetchDocs(); }, []);

  const pendingVerification = docs.filter((d) => d.paymentStatus === 'Pending Verification');

  const handlePayment = async (id, paymentStatus, orNumber) => {
    try {
      await updatePayment(id, { paymentStatus, orNumber });
      toast.success(`Payment marked as ${paymentStatus}`);
      fetchDocs();
    } catch { toast.error('Failed to update payment'); }
  };

  return (
    <AppLayout>
      <h1 className="font-garamond text-3xl font-bold text-gold mb-2">Collector Dashboard</h1>
      <p className="text-white/60 mb-6">Receipts awaiting verification: <span className="text-gold font-bold">{pendingVerification.length}</span></p>

      <div className="space-y-4">
        {pendingVerification.length === 0 && <p className="text-white/50">No receipts to verify.</p>}
        {pendingVerification.map((doc) => (
          <div key={doc._id} className="card">
            <div className="flex flex-wrap justify-between gap-4">
              <div>
                <p className="text-white font-semibold">{doc.documentType}</p>
                <p className="text-white/50 text-sm">{doc.customId} · {doc.resident?.fullName || doc.fullName}</p>
                {doc.receiptFile && (
                  <a
                    href={`/uploads/receipts/${doc.receiptFile}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-gold text-xs underline mt-1 block"
                  >
                    View Receipt
                  </a>
                )}
              </div>
              <div className="flex flex-col gap-2 items-end">
                <span className="text-yellow-300 text-xs font-semibold">Pending Verification</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const or = prompt('Enter OR Number (optional):');
                      handlePayment(doc._id, 'Paid', or);
                    }}
                    className="text-xs bg-green-500/20 text-green-300 px-3 py-1 rounded hover:bg-green-500/40"
                  >
                    Verify Paid
                  </button>
                  <button
                    onClick={() => handlePayment(doc._id, 'Pending')}
                    className="text-xs bg-red-500/20 text-red-300 px-3 py-1 rounded hover:bg-red-500/40"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
