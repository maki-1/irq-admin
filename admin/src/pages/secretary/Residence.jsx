import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  FiSearch, FiEye, FiX,
  FiUser, FiMapPin, FiPhone, FiMail,
  FiCalendar, FiBriefcase, FiCheckCircle, FiXCircle, FiClock,
  FiCreditCard, FiDownload,
} from 'react-icons/fi';
import api from '../../services/api';
import SecretaryLayout from '../../components/layouts/SecretaryLayout';

/* ── Status badge ── */
const STATUS_CFG = {
  Pending:      { bg: '#FFF7ED', color: '#C2610A', label: 'Pending'      },
  'Under Review': { bg: '#EFF6FF', color: '#1D6DB5', label: 'Under Review' },
  Verified:     { bg: '#F0FDF4', color: '#156D07', label: 'Verified'     },
  Rejected:     { bg: '#FFF1F2', color: '#BE123C', label: 'Rejected'     },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.Pending;
  return (
    <span
      className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color, fontFamily: "'Hanken Grotesk', sans-serif" }}
    >
      {status === 'Verified'     && <FiCheckCircle size={11} />}
      {status === 'Rejected'     && <FiXCircle size={11} />}
      {status === 'Under Review' && <FiClock size={11} />}
      {cfg.label}
    </span>
  );
}

/* ── Info row used inside the modal ── */
function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
        style={{ background: '#F0FDF4' }}>
        <Icon size={13} color="#156D07" />
      </div>
      <div>
        <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#A18D8D', fontSize: 11 }}>{label}</p>
        <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#333', fontSize: 13 }}>{value}</p>
      </div>
    </div>
  );
}

/* ── Review Modal ── */
function ReviewModal({ profile, onClose, onSave }) {
  const [status,  setStatus]  = useState(profile.status === 'Pending' ? 'Under Review' : profile.status);
  const [remarks, setRemarks] = useState(profile.remarks || '');
  const [saving,  setSaving]  = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(profile._id, status, remarks);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const dob = profile.dateOfBirth
    ? new Date(profile.dateOfBirth).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative w-full max-w-lg rounded-3xl overflow-hidden flex flex-col"
        style={{ background: '#FFFFFF', maxHeight: '90vh', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid #F0EAEA' }}>
          <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 18 }}>
            Review Profile
          </p>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
            <FiX size={18} color="#827575" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 flex flex-col gap-5">

          {/* Resident summary */}
          <div className="flex items-center gap-4 p-4 rounded-2xl" style={{ background: '#F9F7F7' }}>
            <div className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center text-white text-xl font-bold shrink-0"
              style={{ background: '#156D07' }}>
              {profile.facePhoto
                ? <img src={profile.facePhoto} alt="face" className="w-full h-full object-cover" />
                : profile.fullName?.charAt(0).toUpperCase()}
            </div>
            <div>
              <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 17 }}>
                {profile.fullName}
              </p>
              <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 12 }}>
                {profile.purok}
              </p>
              <div className="mt-1"><StatusBadge status={profile.status} /></div>
            </div>
          </div>

          {/* Personal details */}
          <div>
            <p className="mb-3" style={{ fontFamily: "'Kaisei Decol', serif", color: '#827575', fontSize: 13 }}>
              Personal Information
            </p>
            <div className="grid grid-cols-2 gap-3">
              <InfoRow icon={FiMail}      label="Email"          value={profile.email} />
              <InfoRow icon={FiPhone}     label="Contact"        value={profile.contactNumber} />
              <InfoRow icon={FiCalendar}  label="Date of Birth"  value={dob} />
              <InfoRow icon={FiUser}      label="Gender"         value={profile.gender} />
              <InfoRow icon={FiUser}      label="Civil Status"   value={profile.civilStatus} />
              <InfoRow icon={FiBriefcase} label="Occupation"     value={profile.occupation} />
              <InfoRow icon={FiMapPin}    label="Nationality"    value={profile.nationality} />
              <InfoRow icon={FiCreditCard}label="ID Type"        value={profile.idType} />
              <InfoRow icon={FiCreditCard}label="Name on ID"     value={profile.idName} />
            </div>
          </div>

          {/* Uploaded documents */}
          {(() => {
            const docs = [
              { label: 'ID Front',               url: profile.idFront              },
              { label: 'ID Back',                url: profile.idBack               },
              { label: 'Face Photo',             url: profile.facePhoto            },
              { label: 'Education Certificate',  url: profile.educationCertificate },
              { label: 'Proof of Residency',     url: profile.proofOfResidency     },
              { label: 'Government ID',          url: profile.governmentId         },
              { label: 'Selfie with ID',         url: profile.selfieWithId         },
            ].filter((d) => d.url);
            if (docs.length === 0) return null;
            return (
              <div>
                <p className="mb-3" style={{ fontFamily: "'Kaisei Decol', serif", color: '#827575', fontSize: 13 }}>
                  Submitted Documents
                </p>
                <div className="flex flex-wrap gap-3">
                  {docs.map((doc) => (
                    <a key={doc.label} href={doc.url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs hover:bg-gray-50 transition-colors"
                      style={{ borderColor: '#E0D8D8', color: '#156D07', fontFamily: "'Hanken Grotesk', sans-serif" }}>
                      <FiEye size={13} />
                      {doc.label}
                    </a>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Review decision */}
          <div>
            <p className="mb-3" style={{ fontFamily: "'Kaisei Decol', serif", color: '#827575', fontSize: 13 }}>
              Decision
            </p>
            <div className="flex gap-2 mb-3">
              {['Under Review', 'Verified', 'Rejected'].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all border"
                  style={{
                    fontFamily: "'Hahmlet', sans-serif",
                    background: status === s ? STATUS_CFG[s].bg    : '#F9F7F7',
                    color:      status === s ? STATUS_CFG[s].color : '#A18D8D',
                    borderColor: status === s ? STATUS_CFG[s].color : 'transparent',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>

            <label style={{ fontFamily: "'Kaisei Decol', serif", color: '#827575', fontSize: 13, display: 'block', marginBottom: 6 }}>
              Remarks (optional)
            </label>
            <textarea
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Add notes or reason for decision…"
              className="w-full resize-none rounded-xl px-4 py-3 text-sm focus:outline-none"
              style={{
                fontFamily: "'Hanken Grotesk', sans-serif",
                background: '#F9F7F7',
                border: '1px solid #E8E0E0',
                color: '#333',
              }}
            />
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex gap-3 px-6 py-4" style={{ borderTop: '1px solid #F0EAEA' }}>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-gray-100"
            style={{ fontFamily: "'Hahmlet', sans-serif", color: '#827575', background: '#F5F0F0' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium transition-opacity disabled:opacity-60"
            style={{ fontFamily: "'Hahmlet', sans-serif", background: '#156D07' }}
          >
            {saving ? 'Saving…' : 'Save Decision'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   RESIDENCE PAGE
══════════════════════════════════════════ */
const PAGE_SIZE = 10;

export default function Residence() {
  const [profiles, setProfiles] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [filter,   setFilter]   = useState('All');
  const [selected, setSelected] = useState(null); // profile open in modal
  const [page,     setPage]     = useState(1);

  const fetchProfiles = async () => {
    try {
      const { data } = await api.get('/verifications');
      setProfiles(data);
    } catch {
      toast.error('Failed to load profiles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfiles(); }, []);

  const handleReview = async (id, status, remarks) => {
    try {
      await api.patch(`/verifications/${id}/review`, { status, remarks });
      toast.success(`Profile marked as ${status}`);
      fetchProfiles();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update');
      throw err;
    }
  };

  /* Filter + search */
  const filtered = profiles.filter((p) => {
    const matchFilter = filter === 'All' || p.status === filter;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      p.fullName?.toLowerCase().includes(q) ||
      p.purok?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const visible    = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const counts = profiles.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});

  const FILTERS = ['All', 'Pending', 'Under Review', 'Verified', 'Rejected'];

  /* Reset to page 1 when filter or search changes */
  useEffect(() => { setPage(1); }, [filter, search]);

  /* Export filtered data as CSV */
  const handleExport = () => {
    if (filtered.length === 0) {
      toast.error('No data to export for the current filter.');
      return;
    }

    const columns = [
      { header: 'Full Name',     key: 'fullName'     },
      { header: 'Email',         key: 'email'        },
      { header: 'Contact',       key: 'contactNumber'},
      { header: 'Purok/Address', key: 'purok'        },
      { header: 'Gender',        key: 'gender'       },
      { header: 'Civil Status',  key: 'civilStatus'  },
      { header: 'Date of Birth', key: 'dateOfBirth'  },
      { header: 'Occupation',    key: 'occupation'   },
      { header: 'Nationality',   key: 'nationality'  },
      { header: 'ID Type',       key: 'idType'       },
      { header: 'Status',        key: 'status'       },
      { header: 'Remarks',       key: 'remarks'      },
    ];

    const escape = (val) => {
      if (val == null) return '';
      const str = String(val).replace(/"/g, '""');
      return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
    };

    const header = columns.map((c) => c.header).join(',');
    const rows = filtered.map((p) =>
      columns.map((c) => {
        if (c.key === 'dateOfBirth' && p.dateOfBirth) {
          return escape(new Date(p.dateOfBirth).toLocaleDateString('en-PH'));
        }
        return escape(p[c.key]);
      }).join(',')
    );

    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const label = filter === 'All' ? 'All' : filter.replace(/\s+/g, '_');
    a.href     = url;
    a.download = `residents_${label}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} record${filtered.length !== 1 ? 's' : ''}`);
  };

  return (
    <SecretaryLayout title="RESIDENCE">
      <div className="flex flex-col gap-4" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>

        {/* Summary chips */}
        <div className="flex flex-wrap gap-3">
          {FILTERS.map((f) => {
            const count = f === 'All' ? profiles.length : (counts[f] || 0);
            const isActive = filter === f;
            const cfg = STATUS_CFG[f];
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all border"
                style={{
                  fontFamily: "'Hahmlet', sans-serif",
                  background:  isActive ? (cfg?.bg  || '#156D07') : '#FFFFFF',
                  color:       isActive ? (cfg?.color || '#FFFFFF') : '#827575',
                  borderColor: isActive ? (cfg?.color || '#156D07') : '#E0D8D8',
                  boxShadow:   isActive ? '0 2px 6px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                {f}
                <span
                  className="rounded-full px-2 py-0.5 text-xs"
                  style={{ background: isActive ? 'rgba(0,0,0,0.12)' : '#F0EAEA', color: isActive ? 'inherit' : '#A18D8D' }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search bar + Export */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative max-w-sm flex-1">
            <FiSearch size={15} color="#A18D8D"
              style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search by name, purok or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none"
              style={{
                fontFamily: "'Hanken Grotesk', sans-serif",
                background: '#FFFFFF',
                border: '1px solid #E0D8D8',
                color: '#333',
              }}
            />
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shrink-0"
            style={{
              fontFamily: "'Hahmlet', sans-serif",
              background: '#156D07',
              color: '#FFFFFF',
              border: '1px solid #156D07',
            }}
          >
            <FiDownload size={14} />
            Export{filter !== 'All' ? ` (${filter})` : ''} CSV
          </button>
        </div>

        {/* Table card */}
        <div className="bg-white rounded-3xl overflow-hidden"
          style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: 560 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #F0EAEA', background: '#FAFAFA' }}>
                  {['#', 'NAME', 'ADDRESS', 'STATUS', 'REVIEW'].map((h) => (
                    <th
                      key={h}
                      className={`px-5 py-3 text-left ${h === 'REVIEW' ? 'text-center' : ''}`}
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
                    <td colSpan={5} className="py-10 text-center text-sm" style={{ color: '#C0B0B0' }}>
                      Loading…
                    </td>
                  </tr>
                )}
                {!loading && visible.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-sm" style={{ color: '#C0B0B0' }}>
                      No profiles found
                    </td>
                  </tr>
                )}
                {!loading && visible.map((p, idx) => {
                  const globalIdx = (safePage - 1) * PAGE_SIZE + idx + 1;
                  return (
                  <tr
                    key={p._id}
                    className="transition-colors hover:bg-gray-50"
                    style={{ borderBottom: '1px solid #FAF7F7' }}
                  >
                    {/* # */}
                    <td className="px-5 py-3" style={{ color: '#C0B0B0', fontSize: 13 }}>
                      {globalIdx}
                    </td>

                    {/* Name */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ background: '#156D07' }}
                        >
                          {p.fullName?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#333', fontSize: 13, fontWeight: 600 }}>
                            {p.fullName}
                          </p>
                          <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 11 }}>
                            {p.email || '—'}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Address */}
                    <td className="px-5 py-3">
                      <span style={{ fontFamily: "'Inika', serif", color: '#A18D8D', fontSize: 13 }}>
                        {p.purok}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3">
                      <StatusBadge status={p.status} />
                    </td>

                    {/* Review button */}
                    <td className="px-5 py-3 text-center">
                      <button
                        onClick={() => setSelected(p)}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-medium transition-colors"
                        style={{
                          fontFamily: "'Hahmlet', sans-serif",
                          background: '#F0FDF4',
                          color: '#156D07',
                          border: '1px solid #BBF7D0',
                        }}
                      >
                        <FiEye size={13} />
                        Review
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer — count + pagination */}
          {!loading && (
            <div className="flex items-center justify-between px-5 py-3 flex-wrap gap-2"
              style={{ borderTop: '1px solid #F5F0F0' }}>
              <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#C0B0B0', fontSize: 12 }}>
                Showing {visible.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–{(safePage - 1) * PAGE_SIZE + visible.length} of {filtered.length} resident{filtered.length !== 1 ? 's' : ''}
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    disabled={safePage === 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors disabled:opacity-40"
                    style={{ background: safePage === 1 ? '#F5F0F0' : '#F0FDF4', color: '#156D07', border: '1px solid #BBF7D0' }}
                  >‹</button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium transition-colors"
                      style={{
                        fontFamily: "'Hanken Grotesk', sans-serif",
                        background: n === safePage ? '#156D07' : '#F9F7F7',
                        color:      n === safePage ? '#FFFFFF'  : '#827575',
                        border: n === safePage ? 'none' : '1px solid #E0D8D8',
                      }}
                    >{n}</button>
                  ))}
                  <button
                    disabled={safePage === totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors disabled:opacity-40"
                    style={{ background: safePage === totalPages ? '#F5F0F0' : '#F0FDF4', color: '#156D07', border: '1px solid #BBF7D0' }}
                  >›</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Review modal — rendered outside the scrollable div so it overlays properly */}
      {selected && (
        <ReviewModal
          profile={selected}
          onClose={() => setSelected(null)}
          onSave={handleReview}
        />
      )}
    </SecretaryLayout>
  );
}
