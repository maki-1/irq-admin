import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import useAuthStore from '../../store/authStore';

const LOGO_URL = 'https://res.cloudinary.com/dvw7ky1xq/image/upload/v1776609755/irequestd/avatars/failcg8kkyyqn1knmhu1.jpg';
const ICON_URL = 'https://res.cloudinary.com/dvw7ky1xq/image/upload/v1779908544/ChatGPT_Image_May_28_2026_02_45_11_AM_dlrlcc.png';

function IllustrationPanel() {
  return (
    <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center bg-primary px-10 py-12 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-white/5" />
      <div className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full bg-white/5" />
      <div className="absolute top-1/3 -right-8 w-40 h-40 rounded-full bg-white/5" />

      {/* Illustration image */}
      <div className="relative z-10 w-full flex items-center justify-center mb-[-150px]">
        <img
          src={ICON_URL}
          alt="OTP Illustration"
          className="w-full max-w-lg object-contain drop-shadow-2xl"
        />
      </div>

      {/* Tagline — directly below icon */}
      <div className="relative z-10 text-center">
        <h2 className="text-white text-4xl font-extrabold leading-tight tracking-tight">
          i<span className="italic">Request</span> Dologon
        </h2>
        <p className="text-white/70 text-lg mt-2 font-medium">Submit your document request anytime, anywhere.</p>
      </div>
    </div>
  );
}

export default function Otp() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [digits, setDigits] = useState(Array(6).fill(''));
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const refs = useRef([]);

  const userId = state?.userId;
  const contact = state?.contact || '';
  const maskedContact = contact ? contact.slice(0, 4) + '***' + contact.slice(-3) : 'your registered mobile number/email';

  useEffect(() => {
    if (!userId) { navigate('/signup'); return; }
  }, [userId, navigate]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  function handleChange(i, val) {
    if (!/^\d?$/.test(val)) return;
    const next = [...digits];
    next[i] = val;
    setDigits(next);
    if (val && i < 5) refs.current[i + 1]?.focus();
  }

  function handleKeyDown(i, e) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  }

  function handlePaste(e) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length === 6) {
      setDigits(text.split(''));
      refs.current[5]?.focus();
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const otp = digits.join('');
    if (otp.length < 6) return toast.error('Enter all 6 digits');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-otp', { userId, otp });
      login(data.token, data.user);
      toast.success('Phone verified! Complete your profile.');
      navigate('/verify/step1');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid OTP');
      setDigits(Array(6).fill(''));
      refs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (countdown > 0) return;
    setResendLoading(true);
    try {
      await api.post('/auth/resend-otp', { userId });
      toast.success('OTP resent!');
      setCountdown(60);
      setDigits(Array(6).fill(''));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend OTP');
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left — illustration */}
      <IllustrationPanel />

      {/* Right — form */}
      <div className="flex-1 lg:w-1/2 flex flex-col items-center justify-center bg-white px-8 py-12 lg:px-16">

        {/* Middle — OTP form */}
        <div className="w-full max-w-sm flex flex-col items-center gap-6">
          <div className="text-center">
            <img src={LOGO_URL} alt="iRequestDologon" className="w-36 h-36 rounded-2xl object-cover shadow-md border border-gray-100 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-800">Verify with OTP</h1>
            <p className="text-gray-400 text-sm mt-2 leading-relaxed">
              To ensure your security, please enter the One-Time Password<br className="hidden sm:block" />
              (OTP) sent to <span className="text-gray-600 font-medium">{maskedContact}</span> below.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="w-full flex flex-col items-center gap-6">
            {/* OTP Boxes */}
            <div className="flex gap-3 justify-center" onPaste={handlePaste}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => (refs.current[i] = el)}
                  value={d}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  maxLength={1}
                  inputMode="numeric"
                  className={`w-11 h-14 rounded-xl text-center text-xl font-bold transition-all outline-none
                    ${d
                      ? 'border-2 border-primary bg-primary/5 text-primary'
                      : 'border-0 bg-gray-100 text-gray-800'
                    }
                    focus:border-2 focus:border-primary focus:bg-primary/5`}
                />
              ))}
            </div>

            {/* Resend */}
            <p className="text-sm text-gray-400">
              Didn&apos;t receive the OTP?{' '}
              {countdown > 0 ? (
                <span className="text-gray-400">Resend in <strong className="text-gray-600">{countdown}s</strong></span>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendLoading}
                  className="text-primary font-semibold hover:underline disabled:opacity-50"
                >
                  {resendLoading ? 'Sending…' : 'Resend'}
                </button>
              )}
            </p>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-primary text-white font-semibold text-sm
                         hover:bg-green-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              {loading ? <LoadingSpinner size="sm" /> : 'Submit'}
            </button>

            {/* Cancel */}
            <button
              type="button"
              onClick={() => navigate('/signup')}
              className="w-full py-3.5 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold text-sm
                         hover:border-gray-300 hover:bg-gray-50 active:scale-[0.98] transition-all"
            >
              Cancel
            </button>
          </form>
        </div>

        {/* Bottom help */}
        <p className="text-sm text-gray-400">
          Having difficulties with OTP?{' '}
          <button className="text-primary font-semibold hover:underline">Get help</button>
        </p>
      </div>
    </div>
  );
}
