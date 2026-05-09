import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  FiSearch, FiEye, FiX,
  FiUser, FiMapPin, FiPhone, FiMail,
  FiCalendar, FiBriefcase, FiCheckCircle, FiXCircle, FiClock,
  FiCreditCard, FiDownload, FiAlertTriangle,
} from 'react-icons/fi';
import api from '../../services/api';
import CaptainLayout from '../../components/layouts/CaptainLayout';

/* ── Status badge — matches actual MongoDB status values ── */
const STATUS_CFG = {
  pending:      { bg: '#FFF7ED', color: '#C2610A', label: 'Pending'      },
  submitted:    { bg: '#EFF6FF', color: '#1D6DB5', label: 'Submitted'    },
  'under review':{ bg: '#EFF6FF', color: '#1D6DB5', label: 'Under Review' },
  approved:     { bg: '#F0FDF4', color: '#156D07', label: 'Approved'     },
  rejected:     { bg: '#FFF1F2', color: '#BE123C', label: 'Rejected'     },
};

const normStatus = (s) => (s || '').toLowerCase();

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[normStatus(status)] || { bg: '#F5F5F5', color: '#888', label: status || '—' };
  const ns = normStatus(status);
  return (
    <span
      className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color, fontFamily: "'Hanken Grotesk', sans-serif" }}
    >
      {ns === 'approved'                     && <FiCheckCircle size={11} />}
      {ns === 'rejected'                     && <FiXCircle size={11} />}
      {(ns === 'under review' || ns === 'submitted') && <FiClock size={11} />}
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
function ReviewModal({ profile, onClose, onSave, onReset }) {
  const [remarks,    setRemarks]    = useState('');
  const [saving,     setSaving]     = useState(false);
  const [resetting,  setResetting]  = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [imgPreview,  setImgPreview]  = useState(null);
  const [croppedUrl,  setCroppedUrl]  = useState(null);
  const [cropLoading, setCropLoading] = useState(false);

  const ID_LABELS = ['ID Front', 'ID Back'];

  useEffect(() => {
    if (!imgPreview || !ID_LABELS.includes(imgPreview.label)) {
      setCroppedUrl(null);
      return;
    }
    let cancelled = false;
    setCropLoading(true);
    setCroppedUrl(null);

    api.post('/crop-id/detect-id', { imageUrl: imgPreview.url })
      .then(({ data }) => { if (!cancelled) setCroppedUrl(data.croppedImage); })
      .catch(() => { if (!cancelled) setCroppedUrl(null); })
      .finally(() => { if (!cancelled) setCropLoading(false); });

    return () => { cancelled = true; };
  }, [imgPreview]);

  const handleApprove = async () => {
    setSaving(true);
    try {
      await onSave(profile._id, 'approved', '');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleUndoApprove = async () => {
    setSaving(true);
    try {
      await onSave(profile._id, 'under review', '');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const isApproved = normStatus(profile.status) === 'approved';

  const handleReject = async () => {
    setResetting(true);
    try {
      await onReset(profile._id, remarks);
      onClose();
    } finally {
      setResetting(false);
      setShowReject(false);
    }
  };

  const dob = profile.dateOfBirth
    ? new Date(profile.dateOfBirth).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  const age = profile.age != null
    ? String(profile.age)
    : profile.dateOfBirth
      ? String(Math.floor((Date.now() - new Date(profile.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000)))
      : null;

  return (
    <>
    {imgPreview && (
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.88)' }}
        onClick={() => setImgPreview(null)}
      >
        <div className="relative w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-3">
            <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#FFFFFF', fontSize: 15 }}>
              {imgPreview.label}
            </p>
            <button
              onClick={() => setImgPreview(null)}
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.15)' }}
            >
              <FiX size={16} color="#FFFFFF" />
            </button>
          </div>
          <div className="rounded-2xl overflow-hidden flex items-center justify-center"
            style={{ background: '#111', aspectRatio: '85.6/54', width: '100%' }}>
            {cropLoading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: "'Hanken Grotesk', sans-serif" }}>
                  Loading ID…
                </p>
              </div>
            ) : (
              <img
                src={croppedUrl || imgPreview.url}
                alt={imgPreview.label}
                style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
              />
            )}
          </div>
        </div>
      </div>
    )}
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
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0"
              style={{ background: '#156D07' }}>
              {profile.fullName?.charAt(0).toUpperCase()}
            </div>
            <div>
              <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 17 }}>
                {profile.fullName}
              </p>
              <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#A18D8D', fontSize: 12 }}>
                {profile.address || '—'}
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
              <InfoRow icon={FiMail}      label="Email"              value={profile.email} />
              <InfoRow icon={FiPhone}     label="Contact"            value={profile.contactNumber} />
              <InfoRow icon={FiCalendar}  label="Date of Birth"      value={dob} />
              <InfoRow icon={FiCalendar}  label="Age"                value={age} />
              <InfoRow icon={FiUser}      label="Gender"             value={profile.gender} />
              <InfoRow icon={FiUser}      label="Civil Status"       value={profile.civilStatus} />
              <InfoRow icon={FiBriefcase} label="Occupation"         value={profile.occupation} />
              <InfoRow icon={FiBriefcase} label="Education Level"    value={profile.educationLevel} />
              <InfoRow icon={FiMapPin}    label="Nationality"        value={profile.nationality} />
              <InfoRow icon={FiUser}      label="Mother's Name"      value={profile.mothersName} />
              <InfoRow icon={FiUser}      label="Father's Name"      value={profile.fathersName} />
              <InfoRow icon={FiMapPin}    label="Years at Residence" value={profile.yearsAtResidence != null ? String(profile.yearsAtResidence) : null} />
              <InfoRow icon={FiCreditCard}label="ID Type"            value={profile.idType} />
              <InfoRow icon={FiCreditCard}label="Name on ID"         value={profile.idName} />
            </div>
          </div>

          {/* Uploaded documents */}
          {(() => {
            const docs = [
              { label: 'ID Front',               url: profile.idFront              },
              { label: 'ID Back',                url: profile.idBack               },
              { label: 'Education Certificate',  url: profile.educationCertificate },
              { label: 'Proof of Residency',     url: profile.proofOfResidency     },
              { label: 'Free Proof Document',    url: profile.freeProofDocument    },
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
                    <button
                      key={doc.label}
                      onClick={() => setImgPreview(doc)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs hover:bg-gray-50 transition-colors"
                      style={{ borderColor: '#E0D8D8', color: '#156D07', fontFamily: "'Hanken Grotesk', sans-serif" }}
                    >
                      <FiEye size={13} />
                      {doc.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

        </div>

        {/* Footer actions */}
        <div className="px-6 py-4" style={{ borderTop: '1px solid #F0EAEA' }}>
          {showReject ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl"
                style={{ background: '#FFF1F2', border: '1px solid #FECDD3' }}>
                <FiAlertTriangle size={14} color="#BE123C" className="mt-0.5 shrink-0" />
                <p style={{ fontFamily: "'Hanken Grotesk', sans-serif", color: '#BE123C', fontSize: 12, lineHeight: 1.5 }}>
                  This will permanently delete all verification data for <strong>{profile.fullName}</strong>.
                  They will receive a notification to re-submit their information.
                </p>
              </div>
              <label style={{ fontFamily: "'Kaisei Decol', serif", color: '#827575', fontSize: 13, display: 'block', marginBottom: 2 }}>
                Remarks (optional)
              </label>
              <textarea
                rows={3}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Add reason for rejection…"
                className="w-full resize-none rounded-xl px-4 py-3 text-sm focus:outline-none"
                style={{
                  fontFamily: "'Hanken Grotesk', sans-serif",
                  background: '#F9F7F7',
                  border: '1px solid #E8E0E0',
                  color: '#333',
                }}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowReject(false); setRemarks(''); }}
                  disabled={resetting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-gray-100 disabled:opacity-60"
                  style={{ fontFamily: "'Hahmlet', sans-serif", color: '#827575', background: '#F5F0F0' }}
                >
                  No, Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={resetting}
                  className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium transition-opacity disabled:opacity-60"
                  style={{ fontFamily: "'Hahmlet', sans-serif", background: '#BE123C' }}
                >
                  {resetting ? 'Rejecting…' : 'Yes, Reject'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => setShowReject(true)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
                style={{
                  fontFamily: "'Hahmlet', sans-serif",
                  color: '#BE123C',
                  background: '#FFF1F2',
                  border: '1px solid #FECDD3',
                }}
              >
                <FiXCircle size={13} />
                Reject
              </button>
              <button
                onClick={isApproved ? handleUndoApprove : handleApprove}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-opacity disabled:opacity-60 flex items-center justify-center gap-1.5"
                style={{
                  fontFamily: "'Hahmlet', sans-serif",
                  background: isApproved ? '#F0FDF4' : '#156D07',
                  color:      isApproved ? '#156D07' : '#FFFFFF',
                  border:     isApproved ? '1px solid #BBF7D0' : 'none',
                }}
              >
                {saving
                  ? (isApproved ? 'Reverting…' : 'Approving…')
                  : (isApproved ? 'Undo Approve' : 'Approve')
                }
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

/* ══════════════════════════════════════════
   CAPTAIN RESIDENCE PAGE
══════════════════════════════════════════ */
const PAGE_SIZE = 10;

export default function CaptainResidence() {
  const [profiles, setProfiles] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [filter,   setFilter]   = useState('All');
  const [selected, setSelected] = useState(null);
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

  const handleReset = async (id, remarks) => {
    try {
      await api.delete(`/verifications/${id}/reset`, { data: { remarks } });
      toast.success('Verification reset. Resident has been notified to fill up again.');
      fetchProfiles();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset verification');
      throw err;
    }
  };

  /* Filter + search */
  const filtered = profiles.filter((p) => {
    if (!p.facePhoto) return false;
    const matchFilter = filter === 'All' || normStatus(p.status) === normStatus(filter);
    const q = search.toLowerCase();
    const matchSearch = !q ||
      p.fullName?.toLowerCase().includes(q) ||
      p.address?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const visible    = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const counts = profiles.reduce((acc, p) => {
    const k = normStatus(p.status);
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  const FILTERS = ['All', 'pending', 'submitted', 'under review', 'approved'];

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
      { header: 'Address',       key: 'address'      },
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
    <CaptainLayout title="RESIDENCE">
      <div className="flex flex-col gap-4" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>

        {/* Summary chips */}
        <div className="flex flex-wrap gap-3">
          {FILTERS.map((f) => {
            const count = f === 'All' ? profiles.length : (counts[normStatus(f)] || 0);
            const isActive = filter === f;
            const cfg = STATUS_CFG[normStatus(f)];
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
                {f === 'All' ? 'All' : (STATUS_CFG[normStatus(f)]?.label || f)}
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
                    <td className="px-5 py-3" style={{ color: '#C0B0B0', fontSize: 13 }}>
                      {globalIdx}
                    </td>

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

                    <td className="px-5 py-3">
                      <span style={{ fontFamily: "'Inika', serif", color: '#A18D8D', fontSize: 13 }}>
                        {p.address || '—'}
                      </span>
                    </td>

                    <td className="px-5 py-3">
                      <StatusBadge status={p.status} />
                    </td>

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

      {selected && (
        <ReviewModal
          profile={selected}
          onClose={() => setSelected(null)}
          onSave={handleReview}
          onReset={handleReset}
        />
      )}
    </CaptainLayout>
  );
}
