import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FiSave, FiUser, FiUsers, FiFileText, FiTag } from 'react-icons/fi';

const PesoIcon = ({ size = 26, color }) => (
  <span style={{ fontSize: size * 0.85, fontWeight: 800, color, lineHeight: 1, fontFamily: 'sans-serif' }}>₱</span>
);
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import PurokLeaderLayout from '../../components/layouts/PurokLeaderLayout';

const LABEL = {
  fontFamily: "'Kaisei Decol', serif",
  fontSize: 13,
  color: '#827575',
  marginBottom: 4,
  display: 'block',
};
const FIELD = {
  fontFamily: "'Hanken Grotesk', sans-serif",
  fontSize: 14,
  color: '#333',
  background: '#F9F7F7',
  border: '1px solid #E8E0E0',
  borderRadius: 10,
  padding: '10px 14px',
  width: '100%',
  outline: 'none',
};

function InputField({ label, icon: Icon, type = 'text', ...props }) {
  return (
    <div>
      <label style={LABEL}>{label}</label>
      <div className="relative">
        {Icon && (
          <Icon size={15} color="#A18D8D"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
        )}
        <input
          type={type}
          style={{ ...FIELD, paddingLeft: Icon ? 36 : 14 }}
          {...props}
        />
      </div>
    </div>
  );
}

export default function ClearanceFees() {
  const { user } = useAuthStore();
  const [fee,     setFee]     = useState(null);
  const [form,    setForm]    = useState({ feecentavos: '', description: '', purokPresident: '', treasurerName: '' });
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    api.get('/purok-clearance/my-fee')
      .then(({ data }) => {
        setFee(data);
        setForm({
          feecentavos:    data.feecentavos ?? '',
          description:    data.description ?? '',
          purokPresident: data.purokPresident ?? '',
          treasurerName:  data.treasurerName ?? '',
        });
      })
      .catch(() => toast.error('Failed to load fee configuration'))
      .finally(() => setLoading(false));
  }, []);

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.feecentavos || isNaN(Number(form.feecentavos)) || Number(form.feecentavos) < 0) {
      toast.error('Enter a valid fee amount in centavos.'); return;
    }
    setSaving(true);
    try {
      const { data } = await api.patch('/purok-clearance/my-fee', {
        ...form,
        feecentavos: Number(form.feecentavos),
      });
      setFee(data);
      toast.success('Fee configuration updated!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const feeAmount = form.feecentavos
    ? `₱${(Number(form.feecentavos) / 100).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
    : '—';

  return (
    <PurokLeaderLayout title="CLEARANCE FEES">
      <div className="flex flex-col gap-4 max-w-2xl">

        {/* Header card */}
        <div className="bg-white rounded-3xl px-6 py-5"
          style={{ boxShadow: '0 4px 4px rgba(0,0,0,0.15)' }}>
          <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#7C3AED', fontSize: 18 }}>
            {user?.purok} — Fee Configuration
          </p>
          <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 12, marginTop: 4 }}>
            From <code style={{ fontSize: 11 }}>tests / purokclearance_fee</code> collection.
          </p>
        </div>

        {loading && (
          <div className="bg-white rounded-3xl px-6 py-10 text-center"
            style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
            <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#C0B0B0', fontSize: 14 }}>Loading…</p>
          </div>
        )}

        {!loading && !fee && (
          <div className="bg-white rounded-3xl px-6 py-10 text-center"
            style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
            <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#C0B0B0', fontSize: 14 }}>
              No fee configuration found for <strong>{user?.purok}</strong>. Contact the Barangay Captain.
            </p>
          </div>
        )}

        {!loading && fee && (
          <>
            {/* Current fee preview */}
            <div className="bg-white rounded-3xl px-6 py-5 flex items-center gap-4"
              style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: '#F3F0FF' }}>
                <PesoIcon size={26} color="#7C3AED" />
              </div>
              <div>
                <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 12 }}>
                  Current Clearance Fee
                </p>
                <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#7C3AED', fontSize: 28, fontWeight: 700 }}>
                  {feeAmount}
                </p>
                <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 11, marginTop: 2 }}>
                  {form.feecentavos} centavos
                </p>
              </div>
            </div>

            {/* Edit form */}
            <form onSubmit={handleSave} className="bg-white rounded-3xl p-6 flex flex-col gap-5"
              style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
              <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#7C3AED', fontSize: 16 }}>
                Edit Fee Details
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label style={LABEL}>Purok Name</label>
                  <input
                    readOnly
                    value={fee.purokName}
                    style={{ ...FIELD, color: '#A18D8D', cursor: 'not-allowed' }}
                  />
                </div>

                <InputField
                  label="Fee (centavos)"
                  icon={FiTag}
                  type="number"
                  name="feecentavos"
                  value={form.feecentavos}
                  onChange={onChange}
                  placeholder="e.g. 5000 = ₱50.00"
                  min="0"
                />

                <InputField
                  label="Description"
                  icon={FiFileText}
                  name="description"
                  value={form.description}
                  onChange={onChange}
                  placeholder="e.g. ₱50.00 purok clearance fee"
                />

                <InputField
                  label="Purok President"
                  icon={FiUser}
                  name="purokPresident"
                  value={form.purokPresident}
                  onChange={onChange}
                  placeholder="Full name"
                />

                <InputField
                  label="Treasurer Name"
                  icon={FiUsers}
                  name="treasurerName"
                  value={form.treasurerName}
                  onChange={onChange}
                  placeholder="Full name"
                />
              </div>

              <div className="flex items-center justify-between pt-1" style={{ borderTop: '1px solid #F0EAEA' }}>
                <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#C0B0B0', fontSize: 11 }}>
                  Last updated by: {fee.updatedBy || '—'} &nbsp;·&nbsp;{' '}
                  {new Date(fee.updatedAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
                </p>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-opacity disabled:opacity-60"
                  style={{ fontFamily: "'Hahmlet', sans-serif", background: '#7C3AED' }}
                >
                  <FiSave size={14} />
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </>
        )}

      </div>
    </PurokLeaderLayout>
  );
}
