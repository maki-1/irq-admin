import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import AppLayout from '../../components/layouts/AppLayout';
import { getDocuments, signDocument, sealDocument } from '../../services/document.service';
import api from '../../services/api';

export default function CaptainDashboard() {
  const [docs, setDocs] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [tab, setTab] = useState('sign');

  const fetchData = () => {
    getDocuments().then((r) => setDocs(r.data));
    api.get('/audit').then((r) => setAuditLogs(r.data));
  };

  useEffect(() => { fetchData(); }, []);

  const toSign = docs.filter((d) => d.status === 'Printing' && !d.signatureStatus);
  const toSeal = docs.filter((d) => d.signatureStatus === 'Signed' && !d.sealStatus);

  const handleSign = async (id) => {
    try {
      await signDocument(id);
      toast.success('Document signed');
      fetchData();
    } catch { toast.error('Failed to sign'); }
  };

  const handleSeal = async (id) => {
    try {
      await sealDocument(id);
      toast.success('Document sealed');
      fetchData();
    } catch { toast.error('Failed to seal'); }
  };

  return (
    <AppLayout>
      <h1 className="font-garamond text-3xl font-bold text-gold mb-6">Barangay Captain Dashboard</h1>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card text-center">
          <p className="text-3xl font-bold text-gold">{toSign.length}</p>
          <p className="text-white/60 text-sm mt-1">Awaiting Signature</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-gold">{toSeal.length}</p>
          <p className="text-white/60 text-sm mt-1">Awaiting Seal</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-gold">{docs.filter(d => d.status === 'Completed').length}</p>
          <p className="text-white/60 text-sm mt-1">Completed</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[['sign', 'Sign'], ['seal', 'Seal'], ['audit', 'Audit Trail']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setTab(val)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === val ? 'bg-gold text-green-rich' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Sign queue */}
      {tab === 'sign' && (
        <div className="space-y-3">
          {toSign.length === 0 && <p className="text-white/50">No documents awaiting signature.</p>}
          {toSign.map((doc) => (
            <div key={doc._id} className="card flex justify-between items-center">
              <div>
                <p className="text-white font-medium">{doc.documentType}</p>
                <p className="text-white/50 text-sm">{doc.customId} · {doc.resident?.fullName || doc.fullName}</p>
              </div>
              <button onClick={() => handleSign(doc._id)} className="btn-primary text-sm">Sign</button>
            </div>
          ))}
        </div>
      )}

      {/* Seal queue */}
      {tab === 'seal' && (
        <div className="space-y-3">
          {toSeal.length === 0 && <p className="text-white/50">No documents awaiting seal.</p>}
          {toSeal.map((doc) => (
            <div key={doc._id} className="card flex justify-between items-center">
              <div>
                <p className="text-white font-medium">{doc.documentType}</p>
                <p className="text-white/50 text-sm">{doc.customId} · {doc.resident?.fullName || doc.fullName}</p>
              </div>
              <button onClick={() => handleSeal(doc._id)} className="btn-primary text-sm">Seal</button>
            </div>
          ))}
        </div>
      )}

      {/* Audit trail */}
      {tab === 'audit' && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-gold/70 border-b border-white/10">
                <th className="pb-3 pr-4">Date</th>
                <th className="pb-3 pr-4">User</th>
                <th className="pb-3 pr-4">Role</th>
                <th className="pb-3 pr-4">Action</th>
                <th className="pb-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {auditLogs.map((log) => (
                <tr key={log._id} className="text-white/70">
                  <td className="py-2 pr-4 text-xs">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="py-2 pr-4">{log.username}</td>
                  <td className="py-2 pr-4 text-xs">{log.role}</td>
                  <td className="py-2 pr-4 font-medium">{log.action}</td>
                  <td className="py-2 text-xs text-white/50">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  );
}
