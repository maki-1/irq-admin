import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { MdCheckCircle, MdVerifiedUser } from 'react-icons/md';
import api from '../../services/api';
import StepProgress from '../../components/common/StepProgress';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Logo from '../../components/common/Logo';
import useAuthStore from '../../store/authStore';
import VerifyLayout from '../../components/layout/VerifyLayout';

export default function Step3() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuthStore();
  const storageKey = `irq-didit-session:${user?.id || user?._id}`;
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [session, setSession] = useState(null);
  const [verified, setVerified] = useState(null);
  const [loading, setLoading] = useState(false);
  const busy = loading || status === 'starting' || status === 'checking';

  const finishSubmission = useCallback(() => {
    sessionStorage.removeItem(storageKey);
    updateUser({ verificationStep: 3, verificationStatus: 'pending' });
    navigate('/verify/waiting', { replace: true });
  }, [storageKey, updateUser, navigate]);

  const checkResult = useCallback(async (saved) => {
    setStatus('checking');
    setMessage('');
    setVerified(null);
    try {
      const { data } = await api.post('/verification/identity/complete', {
        resumeToken: saved.resumeToken,
      }, { timeout: 25000 });
      if (data.status === 'pending') {
        setStatus('pending');
        setMessage(data.message);
      } else if (data.status === 'approved' && data.verificationProof) {
        setVerified(data);
        setStatus('passed');
      } else {
        throw new Error('Unexpected verification result');
      }
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'ALREADY_SUBMITTED') return finishSubmission();
      if (['VERIFICATION_EXPIRED', 'INVALID_VERIFICATION', 'DIDIT_NOT_APPROVED', 'DIDIT_CHECKS_INCOMPLETE', 'APPLICATION_CHANGED'].includes(code)) {
        sessionStorage.removeItem(storageKey);
        setSession(null);
      }
      setStatus('failed');
      setMessage(err.response?.data?.message || 'We could not check your result. Please try again.');
    }
  }, [storageKey, finishSubmission]);

  useEffect(() => {
    let saved;
    try { saved = JSON.parse(sessionStorage.getItem(storageKey)); } catch {
      sessionStorage.removeItem(storageKey);
    }
    const params = new URLSearchParams(window.location.search);
    const returning = params.has('verificationSessionId') || params.get('verification') === 'return' || params.get('liveness') === 'return';
    if (returning) window.history.replaceState({}, '', '/verify/step3');
    if (saved?.resumeToken && saved?.url) {
      setSession(saved);
      // Ignore the callback's status/session ID. The server checks our signed session.
      checkResult(saved);
    } else if (returning) {
      setStatus('failed');
      setMessage('We could not resume your check. Return using the browser where you started, or start a new verification.');
    }
  }, [storageKey, checkResult]);

  async function startVerification() {
    setStatus('starting');
    setMessage('');
    setVerified(null);
    try {
      const { data } = await api.post('/verification/identity/session', {}, { timeout: 25000 });
      const saved = { resumeToken: data.resumeToken, url: data.url };
      // Persist before leaving so refreshing or returning from Didit is recoverable.
      sessionStorage.setItem(storageKey, JSON.stringify(saved));
      setSession(saved);
      window.location.assign(data.url);
    } catch (err) {
      if (err.response?.data?.code === 'ALREADY_SUBMITTED') return finishSubmission();
      setStatus('failed');
      setMessage(err.response?.data?.message || 'Could not open verification. Please allow browser storage and try again.');
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!verified?.verificationProof || busy) return;
    setLoading(true);
    try {
      await api.post('/verification/step3', { verificationProof: verified.verificationProof }, { timeout: 60000 });
      toast.success('Verification submitted for review!');
      finishSubmission();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Submission failed. Please try again.');
      if (['VERIFICATION_EXPIRED', 'VERIFICATION_PENDING', 'DIDIT_NOT_APPROVED', 'DIDIT_CHECKS_INCOMPLETE', 'INVALID_VERIFICATION', 'APPLICATION_CHANGED'].includes(err.response?.data?.code)) {
        setVerified(null);
        setStatus('failed');
      }
    } finally { setLoading(false); }
  }

  return (
    <VerifyLayout>
      <div className="min-h-screen bg-mint px-4 py-8 lg:px-16 xl:px-32 lg:py-12">
        <div className="max-w-lg mx-auto lg:max-w-3xl">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Logo size={34} rounded="rounded-xl" />
              <span className="font-extrabold text-xl text-primary">iRequestD</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800">ID &amp; Face Verification</h1>
            <p className="text-gray-500 text-sm mt-1">Step 3 of 3 — Identity Verification</p>
          </div>
          <StepProgress current={3} />
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="card">
              {status === 'passed' ? (
                <div className="text-center py-5">
                  <MdCheckCircle className="text-primary mx-auto mb-3" size={52} />
                  <h2 className="text-lg font-bold text-gray-800">Identity check completed</h2>
                  <p className="text-gray-600 mt-2">Your ID, live selfie, and face match passed verification.</p>
                  <dl className="mt-5 text-sm space-y-2">
                    <div><dt className="text-gray-500">Document</dt><dd className="font-semibold">{verified.idType}</dd></div>
                    {verified.idName && <div><dt className="text-gray-500">Name on ID</dt><dd className="font-semibold">{verified.idName}</dd></div>}
                  </dl>
                  <p className="text-sm text-gray-500 mt-5">Submit below so barangay staff can review your application.</p>
                </div>
              ) : (
                <div className="py-3">
                  <MdVerifiedUser className="text-primary mb-3" size={36} />
                  <h2 className="text-lg font-bold text-gray-800">Verify your identity</h2>
                  <p className="text-sm text-gray-600 mt-2">Scan your ID and take a live selfie using the secure verification service. These images are processed to check your identity. Once complete, return here to submit for barangay review.</p>
                  <ol className="list-decimal pl-5 text-sm text-gray-600 space-y-2 my-5">
                    <li>Have your government-issued photo ID ready.</li>
                    <li>Allow camera access and follow the instructions.</li>
                    <li>Return here and select Submit for Review.</li>
                  </ol>
                  {status === 'checking' ? (
                    <p className="text-primary flex items-center gap-2" role="status"><LoadingSpinner size="sm" /> Checking your result…</p>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      <button type="button" onClick={() => {
                        if (session && new URL(session.url).origin === 'https://verify.didit.me') window.location.assign(session.url);
                        else startVerification();
                      }} disabled={busy} className="btn-primary py-2 px-6 text-sm disabled:opacity-60">
                        {status === 'starting' ? 'Opening verification…' : session ? 'Continue verification' : 'Start ID & Face Check'}
                      </button>
                      {session && <button type="button" onClick={() => checkResult(session)} disabled={busy} className="btn-outline py-2 px-4 text-sm">Check result</button>}
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-5">If your ID is not supported or you only have supporting documents, contact the barangay office for help with verification.</p>
                </div>
              )}
              {message && <p role="alert" className={`text-sm mt-4 ${status === 'pending' ? 'text-gray-600' : 'text-red-600'}`}>{message}</p>}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => navigate('/verify/step2')} disabled={busy} className="btn-outline flex-1">← Back</button>
              <button type="submit" disabled={busy || !verified?.verificationProof} className="btn-primary flex-1 flex items-center justify-center gap-2">
                {loading ? <LoadingSpinner size="sm" /> : 'Submit for Review'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </VerifyLayout>
  );
}
