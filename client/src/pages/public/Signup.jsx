import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { MdVisibility, MdVisibilityOff, MdCheckCircle, MdCancel } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../services/api';
import PasswordStrengthMeter from '../../components/common/PasswordStrengthMeter';
import LoadingSpinner from '../../components/common/LoadingSpinner';

function useDebounce(value, delay = 500) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function FieldStatus({ status }) {
  if (status === 'checking') return <LoadingSpinner size="sm" className="inline-flex" />;
  if (status === 'available') return <MdCheckCircle className="text-primary" size={18} />;
  if (status === 'taken') return <MdCancel className="text-red-500" size={18} />;
  return null;
}

export default function Signup() {
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checks, setChecks] = useState({ username: null, contact: null, email: null });
  const navigate = useNavigate();

  const { register, handleSubmit, watch, formState: { errors } } = useForm();
  const password = watch('password', '');
  const username = watch('username', '');
  const contact = watch('contactNumber', '');
  const email = watch('email', '');

  const dUsername = useDebounce(username);
  const dContact = useDebounce(contact);
  const dEmail = useDebounce(email);

  useEffect(() => {
    if (dUsername.length < 3) return;
    setChecks((c) => ({ ...c, username: 'checking' }));
    api.get(`/auth/check-username?username=${dUsername}`)
      .then((r) => setChecks((c) => ({ ...c, username: r.data.available ? 'available' : 'taken' })))
      .catch(() => setChecks((c) => ({ ...c, username: null })));
  }, [dUsername]);

  useEffect(() => {
    if (!/^09\d{9}$/.test(dContact)) return;
    setChecks((c) => ({ ...c, contact: 'checking' }));
    api.get(`/auth/check-contact?contact=${dContact}`)
      .then((r) => setChecks((c) => ({ ...c, contact: r.data.available ? 'available' : 'taken' })))
      .catch(() => setChecks((c) => ({ ...c, contact: null })));
  }, [dContact]);

  useEffect(() => {
    if (!dEmail || !/\S+@\S+\.\S+/.test(dEmail)) return;
    setChecks((c) => ({ ...c, email: 'checking' }));
    api.get(`/auth/check-email?email=${dEmail}`)
      .then((r) => setChecks((c) => ({ ...c, email: r.data.available ? 'available' : 'taken' })))
      .catch(() => setChecks((c) => ({ ...c, email: null })));
  }, [dEmail]);

  async function onSubmit(values) {
    if (checks.username === 'taken') return toast.error('Username is already taken');
    if (checks.contact === 'taken') return toast.error('Contact number is already registered');
    if (checks.email === 'taken') return toast.error('Email is already registered');
    if (values.password !== values.confirmPassword) return toast.error('Passwords do not match');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', {
        username: values.username,
        contactNumber: values.contactNumber,
        email: values.email || undefined,
        password: values.password,
      });
      const userId = data.userId || data.data?.userId || data.user?.id;
      toast.success('Account created! Please verify your OTP.');
      navigate('/otp', { state: { userId, contact: values.contactNumber } });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <span className="text-white font-extrabold text-xl">i</span>
            </div>
            <span className="font-extrabold text-2xl text-primary">iRequestD</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">Create account</h1>
          <p className="text-gray-500 text-sm mt-1">Join your barangay's digital portal</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div>
              <label className="label">Username</label>
              <div className="relative">
                <input
                  {...register('username', { required: 'Required', minLength: { value: 3, message: 'Min 3 characters' } })}
                  className="input-field pr-10"
                  placeholder="Choose a username"
                  autoComplete="username"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  <FieldStatus status={checks.username} />
                </span>
              </div>
              {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username.message}</p>}
              {checks.username === 'taken' && <p className="text-red-500 text-xs mt-1">Username already taken</p>}
              {checks.username === 'available' && <p className="text-primary text-xs mt-1">Username available</p>}
            </div>

            <div>
              <label className="label">Contact Number</label>
              <div className="relative">
                <input
                  {...register('contactNumber', {
                    required: 'Required',
                    pattern: { value: /^09\d{9}$/, message: 'Must be 09XXXXXXXXX (11 digits)' },
                  })}
                  className="input-field pr-10"
                  placeholder="09XXXXXXXXX"
                  type="tel"
                  inputMode="numeric"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  <FieldStatus status={checks.contact} />
                </span>
              </div>
              {errors.contactNumber && <p className="text-red-500 text-xs mt-1">{errors.contactNumber.message}</p>}
              {checks.contact === 'taken' && <p className="text-red-500 text-xs mt-1">Contact number already registered</p>}
            </div>

            <div>
              <label className="label">Email <span className="text-gray-400 font-normal">(optional)</span></label>
              <div className="relative">
                <input
                  {...register('email', {
                    pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' },
                  })}
                  className="input-field pr-10"
                  placeholder="your@email.com"
                  type="email"
                  autoComplete="email"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  <FieldStatus status={checks.email} />
                </span>
              </div>
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  {...register('password', {
                    required: 'Required',
                    minLength: { value: 8, message: 'Min 8 characters' },
                    validate: (v) => {
                      if (!/[A-Z]/.test(v)) return 'Need at least one uppercase letter';
                      if (!/[0-9]/.test(v)) return 'Need at least one number';
                      if (!/[^A-Za-z0-9]/.test(v)) return 'Need at least one special character';
                      return true;
                    },
                  })}
                  type={showPw ? 'text' : 'password'}
                  className="input-field pr-12"
                  placeholder="Min 8 chars, uppercase, digit, special"
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPw ? <MdVisibilityOff size={20} /> : <MdVisibility size={20} />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
              <PasswordStrengthMeter password={password} />
            </div>

            <div>
              <label className="label">Confirm Password</label>
              <div className="relative">
                <input
                  {...register('confirmPassword', { required: 'Required' })}
                  type={showConfirm ? 'text' : 'password'}
                  className="input-field pr-12"
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showConfirm ? <MdVisibilityOff size={20} /> : <MdVisibility size={20} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary flex items-center justify-center gap-2 mt-2">
              {loading ? <LoadingSpinner size="sm" /> : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-600 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-primary font-semibold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
