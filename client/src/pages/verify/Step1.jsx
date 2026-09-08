import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import StepProgress from '../../components/common/StepProgress';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Logo from '../../components/common/Logo';
import useAuthStore from '../../store/authStore';
import VerifyLayout from '../../components/layout/VerifyLayout';

const CIVIL_STATUS = ['Single', 'Married', 'Widowed', 'Separated', 'Annulled'];

const PUROKS = [
  'Purok 1', 'Purok 2', 'Purok 3', 'Purok 4', 'Purok 5',
  'Purok 6', 'Purok 7', 'Purok 8', 'Purok 9', 'Purok 10',
  'Purok 11', 'Purok 12', 'Purok 13', 'Purok 14', 'Purok 15',
  'Purok 16', 'Purok 17', 'Purok 18', 'Purok 19', 'Purok 20',
  'Purok 21',
];

export default function Step1() {
  const navigate = useNavigate();
  const { updateUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [certified, setCertified] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [isPwd, setIsPwd] = useState(false);
  const [isIndigent, setIsIndigent] = useState(false);
  const [isSoloParent, setIsSoloParent] = useState(false);
  const [isIndigenousPeople, setIsIndigenousPeople] = useState(false);
  const [isPregnant, setIsPregnant] = useState(false);
  const [isNonResident, setIsNonResident] = useState(false);
  const [pwdProof, setPwdProof] = useState(null);
  const [indigentProof, setIndigentProof] = useState(null);

  const { register, handleSubmit, watch, formState: { errors } } = useForm();
  const birthday = watch('birthday');

  function calcAge(dob) {
    if (!dob) return null;
    const today = new Date();
    const birth = new Date(dob);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  }

  const age = calcAge(birthday);
  const isSenior = age !== null && age >= 60;

  async function onSubmit(values) {
    if (!certified) return toast.error('Please certify that your information is true and accurate');
    if (!privacyConsent) return toast.error('Please consent to the Data Privacy Act before proceeding');
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(values).forEach(([k, v]) => fd.append(k, v));
      fd.set('barangay', 'Dologon');
      fd.set('city', 'Maramag');
      fd.set('isPwd', isPwd);
      fd.set('isSenior', isSenior);
      fd.set('isIndigent', isIndigent);
      fd.set('isSoloParent', isSoloParent);
      fd.set('isIndigenousPeople', isIndigenousPeople);
      fd.set('isPregnant', isPregnant);
      fd.set('isNonResident', isNonResident);
      if (!isIndigenousPeople) fd.delete('ethnicGroup');
      fd.set('age', age);
      if (isPwd && pwdProof) fd.append('pwdProof', pwdProof);
      if (isIndigent && indigentProof) fd.append('indigentProof', indigentProof);

      await api.post('/verification/step1', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      updateUser({ verificationStep: 1 });
      toast.success('Step 1 saved!');
      navigate('/verify/step2');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save step 1');
    } finally {
      setLoading(false);
    }
  }

  return (
    <VerifyLayout>
    <div className="min-h-screen bg-mint px-4 py-8 lg:px-16 xl:px-32 lg:py-12">
      <div className="max-w-lg mx-auto lg:max-w-3xl">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Logo size={34} rounded="rounded-xl" />
            <span className="font-extrabold text-xl text-primary">iRequestDologon</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Complete your profile</h1>
          <p className="text-gray-500 text-sm mt-1">Step 1 of 3 — Personal Information</p>
        </div>

        <StepProgress current={1} />

        <div className="card">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="label">First Name</label>
                <input {...register('firstName', { required: 'Required' })} className="input-field" placeholder="Juan" />
                {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName.message}</p>}
              </div>
              <div>
                <label className="label">Middle Name</label>
                <input {...register('middleName')} className="input-field" placeholder="Santos" />
              </div>
              <div>
                <label className="label">Last Name</label>
                <input {...register('lastName', { required: 'Required' })} className="input-field" placeholder="dela Cruz" />
                {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName.message}</p>}
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={certified}
                onChange={(e) => setCertified(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-primary shrink-0"
              />
              <span className="text-sm text-gray-600">
                I certify that all the information I will provide is true and accurate to the best of my knowledge.
              </span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Birthday</label>
                <input {...register('birthday', { required: 'Required' })} type="date" className="input-field" />
                {errors.birthday && <p className="text-red-500 text-xs mt-1">{errors.birthday.message}</p>}
              </div>
              <div>
                <label className="label">Sex</label>
                <select {...register('gender', { required: 'Required' })} className="input-field">
                  <option value="">Select</option>
                  <option>Male</option>
                  <option>Female</option>
                </select>
                {errors.gender && <p className="text-red-500 text-xs mt-1">{errors.gender.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Civil Status</label>
                <select {...register('civilStatus', { required: 'Required' })} className="input-field">
                  <option value="">Select</option>
                  {CIVIL_STATUS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Year/s of Residency</label>
                <input {...register('yearsAtAddress', { required: 'Required' })} type="number" min="0" className="input-field" placeholder="e.g. 5" />
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">Current Address</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">House No.</label>
                  <input {...register('houseNo')} className="input-field" placeholder="123" />
                </div>
                <div>
                  <label className="label">Purok</label>
                  <select {...register('street', { required: 'Required' })} className="input-field">
                    <option value="">Select Purok</option>
                    {PUROKS.map((p) => <option key={p}>{p}</option>)}
                  </select>
                  {errors.street && <p className="text-red-500 text-xs mt-1">{errors.street.message}</p>}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Mother's Name</label>
                <input {...register('motherName')} className="input-field" placeholder="Full name" />
              </div>
              <div>
                <label className="label">Father's Name</label>
                <input {...register('fatherName')} className="input-field" placeholder="Full name" />
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-3">
              <p className="text-sm font-semibold text-gray-700">Special Categories <span className="text-primary text-xs">(Free document requests)</span></p>

              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setIsPwd(!isPwd)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${isPwd ? 'bg-primary' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow ${isPwd ? 'left-7' : 'left-1'}`} />
                </div>
                <span className="text-sm text-gray-700">Person with Disability (PWD)</span>
              </label>
              {isPwd && (
                <div>
                  <label className="label">PWD Proof Document</label>
                  <input type="file" accept="image/*" onChange={(e) => setPwdProof(e.target.files[0])} className="input-field py-2" />
                </div>
              )}

              <label className="flex items-center gap-3 cursor-pointer">
                <div className={`w-12 h-6 rounded-full transition-colors relative ${isSenior ? 'bg-primary' : 'bg-gray-300'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow ${isSenior ? 'left-7' : 'left-1'}`} />
                </div>
                <span className="text-sm text-gray-700">Senior Citizen</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setIsIndigent(!isIndigent)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${isIndigent ? 'bg-primary' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow ${isIndigent ? 'left-7' : 'left-1'}`} />
                </div>
                <span className="text-sm text-gray-700">Indigent</span>
              </label>
              {isIndigent && (
                <div>
                  <label className="label">Indigency Proof Document</label>
                  <input type="file" accept="image/*" onChange={(e) => setIndigentProof(e.target.files[0])} className="input-field py-2" />
                </div>
              )}

              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setIsSoloParent(!isSoloParent)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${isSoloParent ? 'bg-primary' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow ${isSoloParent ? 'left-7' : 'left-1'}`} />
                </div>
                <span className="text-sm text-gray-700">Solo Parent</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setIsPregnant(!isPregnant)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${isPregnant ? 'bg-primary' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow ${isPregnant ? 'left-7' : 'left-1'}`} />
                </div>
                <span className="text-sm text-gray-700">Pregnant</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setIsNonResident(!isNonResident)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${isNonResident ? 'bg-primary' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow ${isNonResident ? 'left-7' : 'left-1'}`} />
                </div>
                <span className="text-sm text-gray-700">Non-Resident</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setIsIndigenousPeople(!isIndigenousPeople)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${isIndigenousPeople ? 'bg-primary' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow ${isIndigenousPeople ? 'left-7' : 'left-1'}`} />
                </div>
                <span className="text-sm text-gray-700">Indigenous People (IP)</span>
              </label>
              {isIndigenousPeople && (
                <div>
                  <label className="label">Ethnic Group / Tribe</label>
                  <input {...register('ethnicGroup')} className="input-field" placeholder="e.g. Manobo, Higaonon" />
                </div>
              )}
            </div>

            <label className="flex items-start gap-3 cursor-pointer select-none bg-primary/5 border border-primary/20 rounded-xl p-3">
              <input
                type="checkbox"
                checked={privacyConsent}
                onChange={(e) => setPrivacyConsent(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-primary shrink-0"
              />
              <span className="text-sm text-gray-600 leading-relaxed">
                I acknowledge and consent to the collection and processing of my personal information by Barangay Dologon in accordance with{' '}
                <strong className="text-primary">Republic Act No. 10173 (Data Privacy Act of 2012)</strong>.
                My information will be used solely for the purpose of identity verification and barangay document requests, and will be kept confidential and secure.
              </span>
            </label>

            <button type="submit" disabled={loading} className="btn-primary flex items-center justify-center gap-2 mt-2">
              {loading ? <LoadingSpinner size="sm" /> : 'Continue to Step 2 →'}
            </button>
          </form>
        </div>
      </div>
    </div>
    </VerifyLayout>
  );
}
