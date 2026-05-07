import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FiEdit2, FiCheck, FiX } from 'react-icons/fi';
import api from '../../services/api';
import CaptainLayout from '../../components/layouts/CaptainLayout';

// pricecentavos → pesos display (e.g. 10000 → "100.00")
const toPesos = (centavos) => (Number(centavos) / 100).toFixed(2);
// pesos input → centavos to store (e.g. "100" → 10000)
const toCentavos = (pesos) => Math.round(Number(pesos) * 100);

function PriceRow({ doc, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [price,   setPrice]   = useState(toPesos(doc.pricecentavos));
  const [desc,    setDesc]    = useState(doc.description || '');
  const [saving,  setSaving]  = useState(false);

  const handleSave = async () => {
    const num = Number(price);
    if (isNaN(num) || num < 0) { toast.error('Enter a valid price (0 or more).'); return; }
    setSaving(true);
    try {
      const { data } = await api.patch(`/document-prices/${doc._id}`, {
        pricecentavos: toCentavos(price),
        description: desc,
      });
      toast.success(`${doc.documentType} price updated`);
      onSaved(data);
      setEditing(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setPrice(toPesos(doc.pricecentavos));
    setDesc(doc.description || '');
    setEditing(false);
  };

  return (
    <tr className="transition-colors hover:bg-gray-50" style={{ borderBottom: '1px solid #FAF7F7' }}>

      {/* Document type */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: '#F0FDF4' }}>
            <span style={{ fontSize: 16 }}>📄</span>
          </div>
          <div>
            <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#333', fontSize: 13, fontWeight: 600 }}>
              {doc.documentType}
            </p>
            {editing ? (
              <input
                type="text"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Description (optional)"
                className="mt-1 rounded-lg px-2 py-1 text-xs focus:outline-none w-full max-w-xs"
                style={{ fontFamily: "'Hanken Grotesk', sans-serif", background: '#F9F7F7', border: '1px solid #E0D8D8', color: '#555' }}
              />
            ) : (
              <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 11 }}>
                {doc.description || '—'}
              </p>
            )}
          </div>
        </div>
      </td>

      {/* Price */}
      <td className="px-5 py-4">
        {editing ? (
          <div className="flex items-center gap-1">
            <span style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 16 }}>₱</span>
            <input
              type="number"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-28 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
              style={{
                fontFamily: "'Kaisei Decol', serif",
                background: '#F0FDF4',
                border: '1px solid #BBF7D0',
                color: '#156D07',
              }}
              autoFocus
            />
          </div>
        ) : (
          <span style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 22, lineHeight: 1 }}>
            ₱{toPesos(doc.pricecentavos)}
          </span>
        )}
      </td>

      {/* Last updated */}
      <td className="px-5 py-4">
        <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 12 }}>
          {doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
        </p>
        {doc.updatedBy && (
          <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#C0B0B0', fontSize: 11, marginTop: 2 }}>
            by {doc.updatedBy}
          </p>
        )}
      </td>

      {/* Actions */}
      <td className="px-5 py-4 text-center">
        {editing ? (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors disabled:opacity-60"
              style={{ fontFamily: "'Hahmlet', sans-serif", background: '#156D07', color: '#FFFFFF' }}
            >
              <FiCheck size={13} />
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
              style={{ fontFamily: "'Hahmlet', sans-serif", background: '#F5F0F0', color: '#827575' }}
            >
              <FiX size={13} />
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-medium transition-colors"
            style={{
              fontFamily: "'Hahmlet', sans-serif",
              background: '#F0FDF4',
              color: '#156D07',
              border: '1px solid #BBF7D0',
            }}
          >
            <FiEdit2 size={13} />
            Edit Price
          </button>
        )}
      </td>
    </tr>
  );
}

export default function CaptainDocuments() {
  const [prices,  setPrices]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/document-prices')
      .then(({ data }) => setPrices(data))
      .catch(() => toast.error('Failed to load document prices'))
      .finally(() => setLoading(false));
  }, []);

  const handleSaved = (updated) => {
    setPrices((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
  };

  return (
    <CaptainLayout title="DOCUMENT MANAGEMENT">
      <div className="flex flex-col gap-4">

        {/* Header info card */}
        <div className="bg-white rounded-3xl px-6 py-5 flex items-center justify-between"
          style={{ boxShadow: '0 4px 4px rgba(0,0,0,0.15)' }}>
          <div>
            <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 18 }}>
              Document Prices
            </p>
            <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 12, marginTop: 4 }}>
              Set the processing fee for each barangay document type.
            </p>
          </div>
          <div className="text-right">
            <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 32, lineHeight: 1 }}>
              {prices.length}
            </p>
            <p style={{ fontFamily: "'Hahmlet', sans-serif", color: '#A18D8D', fontSize: 11 }}>
              document types
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-3xl overflow-hidden" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: 520 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #F0EAEA', background: '#FAFAFA' }}>
                  {['DOCUMENT TYPE', 'PRICE', 'LAST UPDATED', 'ACTION'].map((h) => (
                    <th
                      key={h}
                      className={`px-5 py-3 text-left ${h === 'ACTION' ? 'text-center' : ''}`}
                      style={{ fontFamily: "'Kaisei Decol', serif", color: '#A18D8D', fontSize: 13, fontWeight: 400 }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-sm" style={{ color: '#C0B0B0' }}>
                      Loading…
                    </td>
                  </tr>
                )}
                {!loading && prices.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-sm" style={{ color: '#C0B0B0' }}>
                      No document types found
                    </td>
                  </tr>
                )}
                {!loading && prices.map((doc) => (
                  <PriceRow key={doc._id} doc={doc} onSaved={handleSaved} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          {!loading && (
            <div className="px-5 py-3" style={{ borderTop: '1px solid #F5F0F0' }}>
              <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#C0B0B0', fontSize: 12 }}>
                {prices.length} document type{prices.length !== 1 ? 's' : ''} · Changes take effect immediately for new requests
              </p>
            </div>
          )}
        </div>
      </div>
    </CaptainLayout>
  );
}
