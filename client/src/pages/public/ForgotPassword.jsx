import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function ForgotPassword() {
  const [stage, setStage] = useState('contact'); // contact | otp
  const [userId, setUserId] = useState(null);
  const [contact, setContact] = useState('');
  const [loading, setLoading] = useState(false);
  const [digits, setDigits] = useState(Array(6).fill(''));
  const [countdown, setCountdown] = useState(0);
  const refs = useRef([]);
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors } } = useForm();

  async function onContactSubmit({ contactNumber }) {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { contactNumber });
      setUserId(data.userId || data.data?.userId);
      setContact(contactNumber);
      setCountdown(60);
      startCountdown();
      setStage('otp');
      toast.success('OTP sent to your number');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Contact number not found');
    } finally {
      setLoading(false);
    }
  }

  function startCountdown() {
    let n = 60;
    const t = setInterval(() => {
      n--;
      setCountdown(n);
      if (n <= 0) clearInterval(t);
    }, 1000);
  }

  function handleDigit(i, val) {
    if (!/^\d?$/.test(val)) return;
    const next = [...digits];
    next[i] = val;
    setDigits(next);
    if (val && i < 5) refs.current[i + 1]?.focus();
  }

  function handleKeyDown(i, e) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  }

  async function handleOtpSubmit(e) {
    e.preventDefault();
    const otp = digits.join('');
    if (otp.length < 6) return toast.error('Enter all 6 digits');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-otp', { userId, otp, type: 'reset' });
      const resetToken = data.resetToken || data.data?.resetToken || data.token;
      toast.success('OTP verified!');
      navigate('/reset-password', { state: { resetToken } });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-mint flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-ink">Forgot Password</h1>
          <p className="text-gray-500 text-sm mt-1">
            {stage === 'contact' ? "Enter your registered contact number" : `Enter the 6-digit code sent to ${contact}`}
          </p>
        </div>

        <div className="card">
          {stage === 'contact' ? (
            <form onSubmit={handleSubmit(onContactSubmit)} className="flex flex-col gap-4">
              <div>
                <label className="label">Contact Number</label>
                <input
                  {...register('contactNumber', {
                    required: 'Required',
                    pattern: { value: /^09\d{9}$/, message: 'Must be 09XXXXXXXXX' },
                  })}
                  className="input-field"
                  placeholder="09XXXXXXXXX"
                  type="tel"
                  inputMode="numeric"
                />
                {errors.contactNumber && <p className="text-red-500 text-xs mt-1">{errors.contactNumber.message}</p>}
              </div>
              <button type="submit" disabled={loading} className="btn-primary flex items-center justify-center gap-2">
                {loading ? <LoadingSpinner size="sm" /> : 'Send OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleOtpSubmit} className="flex flex-col gap-6">
              <div className="flex gap-2 justify-center">
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => (refs.current[i] = el)}
                    value={d}
                    onChange={(e) => handleDigit(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    maxLength={1}
                    inputMode="numeric"
                    className="w-11 h-14 border-2 border-gray-300 rounded-xl text-center text-xl font-bold focus:outline-none focus:border-primary transition-colors"
                  />
                ))}
              </div>
              <button type="submit" disabled={loading} className="btn-primary flex items-center justify-center gap-2">
                {loading ? <LoadingSpinner size="sm" /> : 'Verify OTP'}
              </button>
              <p className="text-center text-sm text-gray-500">
                {countdown > 0 ? `Resend in ${countdown}s` : (
                  <button type="button" onClick={() => onContactSubmit({ contactNumber: contact })} className="text-primary font-semibold hover:underline">
                    Resend OTP
                  </button>
                )}
              </p>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-gray-600 mt-6">
          <Link to="/login" className="text-primary font-semibold hover:underline">← Back to Login</Link>
        </p>
      </div>
    </div>
  );
}
