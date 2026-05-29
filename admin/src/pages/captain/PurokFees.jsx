import { useEffect, useState } from 'react';
import { FiEdit2, FiCheck, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';
import CaptainLayout from '../../components/layouts/CaptainLayout';
import api from '../../services/api';

const PUROKS = Array.from({ length: 21 }, (_, i) => `Purok ${i + 1}`);

function FeeRow({ purok, existing, onSaved }) {
  const [editing, setEditing]   = useState(false);
  const [fee, setFee]           = useState(existing ? (existing.feecentavos / 100).toString() : '');
  const [president, setPresident] = useState(existing?.purokPresident || '');
  const [saving, setSaving]     = useState(false);

  async function save() {
    if (fee === '' || isNaN(Number(fee)) || Number(fee) < 0) {
      toast.error('Enter a valid fee amount'); return;
    }
    setSaving(true);
    try {
      await api.put(`/purok-clearance/${encodeURIComponent(purok)}`, {
        feecentavos:    Math.round(Number(fee) * 100),
        purokPresident: president,
      });
      toast.success(`${purok} fee updated`);
      onSaved();
      setEditing(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-4 py-3" style={{ borderBottom: '1px solid #F5F0F0' }}>
      <div className="w-24 shrink-0">
        <span style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 14, fontWeight: 700 }}>{purok}</span>
      </div>

      {editing ? (
        <>
          <div className="flex-1 flex gap-2 flex-wrap">
            <div className="flex items-center gap-1 rounded-xl px-3 py-1.5" style={{ background: '#F9F7F7', border: '1px solid #E8E0E0' }}>
              <span style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 12 }}>₱</span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                placeholder="0.00"
                className="w-20 text-sm focus:outline-none bg-transparent"
                style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#333' }}
              />
            </div>
            <input
              value={president}
              onChange={(e) => setPresident(e.target.value)}
              placeholder="Purok President name"
              className="flex-1 rounded-xl px-3 py-1.5 text-sm focus:outline-none"
              style={{ fontFamily: "'Hanken Grotesk', sans-serif", background: '#F9F7F7', border: '1px solid #E8E0E0', color: '#333', minWidth: 160 }}
            />
          </div>
          <div className="flex gap-1 shrink-0">
            <button onClick={save} disabled={saving}
              className="w-8 h-8 rounded-xl flex items-center justify-center disabled:opacity-60"
              style={{ background: '#156D07' }}>
              <FiCheck size={14} color="#fff" />
            </button>
            <button onClick={() => setEditing(false)}
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: '#F5F0F0' }}>
              <FiX size={14} color="#827575" />
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex-1">
            <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#333', fontSize: 14, fontWeight: 600 }}>
              {existing ? `₱${(existing.feecentavos / 100).toFixed(2)}` : <span style={{ color: '#A18D8D' }}>Not set</span>}
            </p>
            {existing?.purokPresident && (
              <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 11 }}>
                {existing.purokPresident}
              </p>
            )}
          </div>
          <button onClick={() => { setFee(existing ? (existing.feecentavos / 100).toString() : ''); setPresident(existing?.purokPresident || ''); setEditing(true); }}
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 hover:opacity-80"
            style={{ background: '#F0FDF4' }}>
            <FiEdit2 size={14} color="#156D07" />
          </button>
        </>
      )}
    </div>
  );
}

export default function PurokFees() {
  const [fees, setFees]       = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const { data } = await api.get('/purok-clearance/all-fees');
      setFees(data);
    } catch {
      toast.error('Failed to load fees');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const feeMap = {};
  fees.forEach((f) => { feeMap[f.purokName?.toLowerCase()] = f; });

  return (
    <CaptainLayout title="Purok Clearance Fees">
      <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF' }}>
        <div className="px-6 py-4" style={{ borderBottom: '1px solid #F5F0F0' }}>
          <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 16 }}>
            Purok Clearance Fees
          </p>
          <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 12, marginTop: 2 }}>
            Set the clearance fee charged per purok. This is added on top of the document fee upon Purok Leader approval.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: '#156D07', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <div className="px-6">
            {PUROKS.map((purok) => (
              <FeeRow
                key={purok}
                purok={purok}
                existing={feeMap[purok.toLowerCase()] || null}
                onSaved={load}
              />
            ))}
          </div>
        )}
      </div>
    </CaptainLayout>
  );
}
