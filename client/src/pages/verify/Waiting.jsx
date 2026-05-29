import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdHourglassFull, MdErrorOutline, MdCheckCircle } from 'react-icons/md';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import VerifyLayout from '../../components/layout/VerifyLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function Waiting() {
  const navigate = useNavigate();
  const { user, updateUser, login, token } = useAuthStore();
  const [status, setStatus] = useState(user?.verificationStatus || 'pending');
  const [rejectionReason, setRejectionReason] = useState(user?.rejectionReason || '');

  async function pollStatus() {
    try {
      const { data } = await api.get('/verification/status');
      const s = data.status || data.data?.status;
      const reason = data.rejectionReason || data.data?.rejectionReason || '';
      setStatus(s);
      setRejectionReason(reason);
      if (s === 'approved') {
        const { data: me } = await api.get('/auth/me');
        const updatedUser = me.user || me.data || me;
        login(token, updatedUser);
        updateUser({ isVerified: true });
        navigate('/dashboard');
      }
    } catch {
      // silently fail on poll
    }
  }

  useEffect(() => {
    pollStatus();
    const interval = setInterval(pollStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const isRejected = status === 'rejected';

  return (
    <VerifyLayout>
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center">
        <div className={`w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6 ${isRejected ? 'bg-red-100' : 'bg-primary/10'}`}>
          {isRejected ? (
            <MdErrorOutline size={52} className="text-red-500" />
          ) : (
            <MdHourglassFull size={52} className="text-primary animate-pulse" />
          )}
        </div>

        {isRejected ? (
          <>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Verification Rejected</h1>
            <p className="text-gray-500 text-sm mb-4">Your verification was not approved.</p>
            {rejectionReason && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6 text-left">
                <p className="text-sm font-semibold text-red-700 mb-1">Reason:</p>
                <p className="text-sm text-red-600">{rejectionReason}</p>
              </div>
            )}
            <button
              onClick={() => navigate('/verify/step1')}
              className="btn-primary w-full"
            >
              Re-submit Verification
            </button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Under Review</h1>
            <p className="text-gray-500 text-sm mb-6">
              Your account verification is being reviewed by the barangay staff. This usually takes 1–2 business days.
            </p>

            <div className="card text-left mb-6">
              <div className="flex items-start gap-3">
                <MdCheckCircle className="text-primary mt-0.5 shrink-0" size={20} />
                <div>
                  <p className="font-semibold text-sm text-gray-800">{user?.username}</p>
                  <p className="text-xs text-gray-500">{user?.contactNumber}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-500 justify-center">
              <LoadingSpinner size="sm" />
              Checking status automatically every 30s…
            </div>
            <button onClick={pollStatus} className="mt-4 text-sm text-primary hover:underline">
              Check now
            </button>
          </>
        )}
      </div>
    </div>
    </VerifyLayout>
  );
}
