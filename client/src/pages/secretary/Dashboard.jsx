import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import AppLayout from '../../components/layouts/AppLayout';
import { getDocuments, updateStatus, updatePayment } from '../../services/document.service';
import api from '../../services/api';

const STATUS_COLOR = {
  Pending: 'text-yellow-300',
  Processing: 'text-blue-300',
  Printing: 'text-purple-300',
  Completed: 'text-green-300',
  Rejected: 'text-red-300',
};

export default function SecretaryDashboard() {
  const [docs, setDocs] = useState([]);
  const [users, setUsers] = useState([]);
  const [tab, setTab] = useState('documents');

  const fetchData = () => {
    getDocuments().then((r) => setDocs(r.data));
    api.get('/users').then((r) => setUsers(r.data));
  };

  useEffect(() => { fetchData(); }, []);

  const handleStatusChange = async (id, status) => {
    try {
      await updateStatus(id, { status });
      toast.success(`Status updated to ${status}`);
      fetchData();
    } catch { toast.error('Failed to update status'); }
  };

  const handleVerifyResident = async (userId, residentStatus) => {
    try {
      await api.patch(`/users/${userId}/status`, { residentStatus });
      toast.success(`Resident ${residentStatus}`);
      fetchData();
    } catch { toast.error('Failed to update resident'); }
  };

  return (
    <AppLayout>
      <h1 className="font-garamond text-3xl font-bold text-gold mb-6">Secretary Dashboard</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {['documents', 'residents'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-gold text-green-rich' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Documents tab */}
      {tab === 'documents' && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-gold/70 border-b border-white/10">
                <th className="pb-3 pr-4">ID</th>
                <th className="pb-3 pr-4">Resident</th>
                <th className="pb-3 pr-4">Document</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3 pr-4">Payment</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {docs.map((doc) => (
                <tr key={doc._id} className="text-white/80">
                  <td className="py-3 pr-4 font-mono text-xs">{doc.customId}</td>
                  <td className="py-3 pr-4">{doc.resident?.fullName || doc.fullName}</td>
                  <td className="py-3 pr-4">{doc.documentType}</td>
                  <td className={`py-3 pr-4 font-semibold ${STATUS_COLOR[doc.status]}`}>{doc.status}</td>
                  <td className="py-3 pr-4 text-xs">{doc.paymentStatus}</td>
                  <td className="py-3">
                    <select
                      className="bg-white/10 text-white text-xs rounded px-2 py-1 border border-white/20"
                      value={doc.status}
                      onChange={(e) => handleStatusChange(doc._id, e.target.value)}
                    >
                      {['Pending', 'Processing', 'Printing', 'Completed', 'Rejected'].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Residents tab */}
      {tab === 'residents' && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-gold/70 border-b border-white/10">
                <th className="pb-3 pr-4">Name</th>
                <th className="pb-3 pr-4">Email</th>
                <th className="pb-3 pr-4">Purok</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {users.filter(u => u.role === 'Resident').map((u) => (
                <tr key={u._id} className="text-white/80">
                  <td className="py-3 pr-4">{u.fullName}</td>
                  <td className="py-3 pr-4 text-xs">{u.email}</td>
                  <td className="py-3 pr-4">{u.purok}</td>
                  <td className={`py-3 pr-4 font-semibold ${u.residentStatus === 'Verified' ? 'text-green-300' : u.residentStatus === 'Rejected' ? 'text-red-300' : 'text-yellow-300'}`}>
                    {u.residentStatus}
                  </td>
                  <td className="py-3 flex gap-2">
                    {u.residentStatus !== 'Verified' && (
                      <button onClick={() => handleVerifyResident(u._id, 'Verified')} className="text-xs bg-green-500/20 text-green-300 px-3 py-1 rounded hover:bg-green-500/40">Verify</button>
                    )}
                    {u.residentStatus !== 'Rejected' && (
                      <button onClick={() => handleVerifyResident(u._id, 'Rejected')} className="text-xs bg-red-500/20 text-red-300 px-3 py-1 rounded hover:bg-red-500/40">Reject</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  );
}
