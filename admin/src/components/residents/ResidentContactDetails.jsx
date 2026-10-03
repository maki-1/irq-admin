import { useId, useState } from 'react';
import { FiEdit2, FiMail, FiPhone } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../../services/api';

export default function ResidentContactDetails({ profile, onSaved }) {
  const formId = useId();
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function startEditing() {
    setEmail(profile.email || '');
    setContactNumber(profile.contactNumber || '');
    setError(null);
    setEditing(true);
  }

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    setError(null);
    const nextEmail = email.trim().toLowerCase();
    let nextNumber = contactNumber.trim().replace(/[\s()-]/g, '');
    if (/^\+?639\d{9}$/.test(nextNumber)) nextNumber = '0' + nextNumber.replace(/^\+?63/, '');
    if (nextEmail && (nextEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail))) {
      setError({ field: 'email', message: 'Enter a valid email address.' });
      return;
    }
    if (!/^09\d{9}$/.test(nextNumber)) {
      setError({ field: 'contactNumber', message: 'Use 09XXXXXXXXX or +639XXXXXXXXX.' });
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.patch(`/verifications/${profile._id || profile.id}/contact`, {
        email: nextEmail,
        contactNumber: nextNumber,
        ...(profile.user?.updatedAt ? { expectedUpdatedAt: profile.user.updatedAt } : {}),
      });
      onSaved(data);
      setEditing(false);
      toast.success('Resident contact details updated');
    } catch (err) {
      setError({ field: err.response?.data?.field, canReload: err.response?.status === 409 && !err.response?.data?.field, message: err.response?.data?.message || 'Could not save contact details. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  async function reloadDetails() {
    setSaving(true);
    try {
      const { data } = await api.get(`/verifications/${profile._id || profile.id}`);
      onSaved(data);
      setEmail(data.email || '');
      setContactNumber(data.contactNumber || '');
      setError(null);
    } catch {
      setError({ canReload: true, message: 'Could not reload contact details. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-green-100 bg-green-50/40 p-4" aria-labelledby={`${formId}-heading`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 id={`${formId}-heading`} className="text-sm font-semibold text-gray-800">Contact Details</h3>
        {!editing && !profile.user?.deletedAt && (
          <button type="button" onClick={startEditing}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-green-800 hover:bg-green-100">
            <FiEdit2 size={13} /> Edit contact details
          </button>
        )}
      </div>
      {editing ? (
        <form onSubmit={save} noValidate className="space-y-3">
          <div>
            <label htmlFor={`${formId}-email`} className="mb-1 block text-xs font-medium text-gray-600">Email (optional)</label>
            <input id={`${formId}-email`} name="residentEmail" type="email" autoComplete="off" maxLength={254}
              value={email} onChange={(event) => setEmail(event.target.value)} disabled={saving} autoFocus
              aria-invalid={error?.field === 'email'} aria-describedby={error ? `${formId}-error` : undefined}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100 disabled:opacity-60"
              placeholder="resident@example.com" />
            <p className="mt-1 text-xs text-gray-500">Leave blank to remove the email address.</p>
          </div>
          <div>
            <label htmlFor={`${formId}-phone`} className="mb-1 block text-xs font-medium text-gray-600">Contact number</label>
            <input id={`${formId}-phone`} name="residentContactNumber" type="tel" inputMode="tel" autoComplete="off" required maxLength={24}
              value={contactNumber} onChange={(event) => setContactNumber(event.target.value)} disabled={saving}
              aria-invalid={error?.field === 'contactNumber'} aria-describedby={`${formId}-phone-help${error ? ` ${formId}-error` : ''}`}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100 disabled:opacity-60"
              placeholder="09XXXXXXXXX" />
            <p id={`${formId}-phone-help`} className="mt-1 text-xs text-gray-500">Use 09XXXXXXXXX or +639XXXXXXXXX.</p>
          </div>
          <p className="text-xs leading-relaxed text-gray-600">These details are used for notifications and account recovery. After a change, the resident will need to sign in again.</p>
          {error && <p id={`${formId}-error`} role="alert" className="text-sm text-red-700">{error.message}</p>}
          {error?.canReload && (
            <button type="button" disabled={saving} onClick={reloadDetails} className="text-xs font-semibold text-green-800 underline disabled:opacity-60">
              Reload latest details
            </button>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={saving}
              className="rounded-xl bg-green-800 px-4 py-2 text-xs font-semibold text-white hover:bg-green-900 disabled:opacity-60">
              {saving ? 'Saving...' : 'Save contact details'}
            </button>
            <button type="button" disabled={saving} onClick={() => { setEditing(false); setError(null); }}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="flex items-center gap-1.5 text-xs text-gray-500"><FiMail size={13} /> Email</dt>
            <dd className="mt-1 break-words text-sm text-gray-800">{profile.email || 'Not provided'}</dd>
          </div>
          <div className="min-w-0">
            <dt className="flex items-center gap-1.5 text-xs text-gray-500"><FiPhone size={13} /> Contact number</dt>
            <dd className="mt-1 break-words text-sm text-gray-800">{profile.contactNumber || 'Not provided'}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
