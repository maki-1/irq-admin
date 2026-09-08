import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MdCheckCircle, MdHourglassEmpty, MdRefresh } from 'react-icons/md';
import api from '../../services/api';

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const requestId = params.get('refs');
  const [status, setStatus]   = useState('checking');
  const [retrying, setRetrying] = useState(false);

  const verify = useCallback(async () => {
    if (!requestId) { setStatus('paid'); return; }
    try {
      const { data } = await api.get(`/payment/verify/${requestId}`);
      setStatus(data.paid ? 'paid' : 'pending');
    } catch {
      setStatus('pending');
    }
  }, [requestId]);

  useEffect(() => { verify(); }, [verify]);

  async function handleRetry() {
    setRetrying(true);
    await verify();
    setRetrying(false);
  }

  if (status === 'checking') {
    return (
      <div className="min-h-screen bg-mint flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mint flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center">
        <div className={`w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6 ${status === 'paid' ? 'bg-green-100' : 'bg-yellow-50'}`}>
          {status === 'paid'
            ? <MdCheckCircle size={56} className="text-primary" />
            : <MdHourglassEmpty size={56} className="text-yellow-500" />}
        </div>

        {status === 'paid' ? (
          <>
            <h1 className="text-2xl font-extrabold text-gray-800 mb-2">Payment Successful!</h1>
            <p className="text-gray-500 text-sm mb-8">
              Your payment was received. Barangay staff will process your request and notify you when it's ready for pickup.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold text-gray-800 mb-2">Verifying Payment…</h1>
            <p className="text-gray-500 text-sm mb-4">
              Your payment may still be processing. Click the button below to check again.
            </p>
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="btn-primary inline-flex items-center gap-2 mb-6 disabled:opacity-60"
            >
              <MdRefresh size={18} className={retrying ? 'animate-spin' : ''} />
              {retrying ? 'Checking…' : 'Check Payment Status'}
            </button>
            <br />
          </>
        )}

        <Link to="/requests" className="btn-primary inline-block">
          View My Requests
        </Link>
        <div className="mt-4">
          <Link to="/dashboard" className="text-sm text-primary hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
