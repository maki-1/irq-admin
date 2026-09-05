import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdAdd, MdRemoveCircle } from 'react-icons/md';
import toast from 'react-hot-toast';
import api, { multipartPost } from '../../services/api';
import AppLayout from '../../components/layout/AppLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import useAuthStore from '../../store/authStore';

const PURPOSES = ['Employment', 'Travel', 'Bank', 'Scholarship', 'Government Assistance', 'Legal', 'Other'];

const BASE_DOCS = [
  { type: 'Barangay Clearance', basePrice: 100 },
  { type: 'Certificate of Residency', basePrice: 50 },
  { type: 'Certificate of Indigency', basePrice: 0 },
];

function newItem() {
  return { type: '', purpose: '', details: '', id: Date.now() };
}

export default function NewRequest() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([newItem()]);

  const isFree = user?.isPwd || user?.isSenior || user?.isIndigent;

  useEffect(() => {
    api.get('/admin/prices')
      .then(({ data }) => {
        const p = data.data || data.prices || data || {};
        setPrices(p);
      })
      .catch(() => {});
  }, []);

  function getPrice(docType) {
    if (isFree || docType === 'Certificate of Indigency') return 0;
    const custom = prices[docType];
    if (custom !== undefined) return Number(custom);
    const base = BASE_DOCS.find((d) => d.type === docType);
    return base?.basePrice ?? 0;
  }

  function updateItem(id, field, value) {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, [field]: value } : item));
  }

  function removeItem(id) {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  const total = items.reduce((sum, item) => sum + (item.type ? getPrice(item.type) : 0), 0);
  // Distinguish "nothing chosen yet" (total is 0 because the form is empty) from
  // a genuinely free document. Without this the summary reads FREE by default,
  // before the resident has selected anything.
  const hasSelection = items.some((item) => item.type);

  async function handleSubmit(e) {
    e.preventDefault();
    for (const item of items) {
      if (!item.type) return toast.error('Select a document type for each request');
      if (!item.purpose) return toast.error('Select a purpose for each request');
    }

    setLoading(true);
    try {
      const fd = new FormData();
      items.forEach((item, i) => {
        fd.append(`documents[${i}][type]`, item.type);
        fd.append(`documents[${i}][purpose]`, item.purpose);
        fd.append(`documents[${i}][details]`, item.details || '');
      });

      if (total > 0) {
        // Paid — submit for purok leader approval first
        const { data } = await multipartPost('/payment/create-session', fd);
        if (data.pendingApproval) {
          toast.success('Request submitted! Awaiting Purok Leader approval before payment.');
          navigate('/requests');
        } else {
          const checkoutUrl = data.checkoutUrl || data.data?.checkoutUrl;
          if (checkoutUrl) {
            window.location.href = checkoutUrl;
          } else {
            throw new Error('No checkout URL returned');
          }
        }
      } else {
        // Free — submit directly
        await multipartPost('/my/requests/bulk', fd);
        toast.success('Request submitted successfully!');
        navigate('/requests');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed');
      setLoading(false);
    }
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Request Documents</h1>
        <p className="text-gray-500 text-sm mt-1">Fill in the details for each document you need</p>
        {isFree && (
          <div className="mt-2 inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-full">
            ✓ FREE — {user.isPwd ? 'PWD' : user.isSenior ? 'Senior Citizen' : 'Indigent'} benefit
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {items.map((item, index) => (
          <div key={item.id} className="card relative">
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                className="absolute top-3 right-3 text-red-400 hover:text-red-600"
              >
                <MdRemoveCircle size={22} />
              </button>
            )}
            <p className="text-sm font-bold text-gray-700 mb-3">Document {index + 1}</p>

            <div className="space-y-3">
              <div>
                <label className="label">Document Type</label>
                <select
                  value={item.type}
                  onChange={(e) => updateItem(item.id, 'type', e.target.value)}
                  className="input-field"
                  required
                >
                  <option value="">Select document type</option>
                  {BASE_DOCS.map((doc) => (
                    <option key={doc.type} value={doc.type}>
                      {doc.type} — {isFree || doc.basePrice === 0 ? 'FREE' : `₱${getPrice(doc.type)}`}
                    </option>
                  ))}
                </select>
                {item.type && (
                  <p className="text-xs mt-1 font-semibold text-primary">
                    Price: {getPrice(item.type) === 0 ? 'FREE' : `₱${getPrice(item.type)}`}
                  </p>
                )}
              </div>

              <div>
                <label className="label">Purpose</label>
                <select
                  value={item.purpose}
                  onChange={(e) => updateItem(item.id, 'purpose', e.target.value)}
                  className="input-field"
                  required
                >
                  <option value="">Select purpose</option>
                  {PURPOSES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>

              <div>
                <label className="label">Additional Details <span className="text-gray-400 font-normal">(optional)</span></label>
                <textarea
                  value={item.details}
                  onChange={(e) => updateItem(item.id, 'details', e.target.value)}
                  className="input-field resize-none"
                  rows={2}
                  placeholder="Any additional information…"
                />
              </div>

            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setItems((prev) => [...prev, newItem()])}
          className="w-full border-2 border-dashed border-gray-300 text-gray-500 rounded-xl py-3 flex items-center justify-center gap-2 hover:border-primary hover:text-primary transition-colors text-sm font-medium"
        >
          <MdAdd size={20} /> Add Another Document
        </button>

        {/* Price summary */}
        <div className="card bg-gray-50">
          <p className="font-bold text-gray-800 mb-3">Order Summary</p>
          {items.map((item) => item.type && (
            <div key={item.id} className="flex justify-between text-sm mb-1.5">
              <span className="text-gray-600">{item.type}</span>
              <span className={`font-semibold ${getPrice(item.type) === 0 ? 'text-primary' : 'text-gray-800'}`}>
                {getPrice(item.type) === 0 ? 'FREE' : `₱${getPrice(item.type)}`}
              </span>
            </div>
          ))}
          <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between font-bold">
            <span>Total</span>
            <span className={!hasSelection ? 'text-gray-400' : total === 0 ? 'text-primary' : 'text-gray-800'}>
              {!hasSelection ? '—' : total === 0 ? 'FREE' : `₱${total}`}
            </span>
          </div>
        </div>

        <button type="submit" disabled={loading || !hasSelection} className="btn-primary w-full flex items-center justify-center gap-2 py-4 text-base disabled:opacity-50">
          {loading
            ? <LoadingSpinner size="sm" />
            : !hasSelection
              ? 'Select a document'
              : total > 0
                ? 'Submit & Await Approval'
                : 'Submit Free Request'}
        </button>
      </form>
    </AppLayout>
  );
}
