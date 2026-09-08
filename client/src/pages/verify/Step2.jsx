import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import StepProgress from '../../components/common/StepProgress';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Logo from '../../components/common/Logo';
import useAuthStore from '../../store/authStore';
import VerifyLayout from '../../components/layout/VerifyLayout';

const EDUCATION_LEVELS = ['Elementary', 'High School', 'Senior High School', 'Vocational / Tech-Voc', 'College', 'Post-Graduate'];

export default function Step2() {
  const navigate = useNavigate();
  const { updateUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [certFile, setCertFile] = useState(null);
  const { register, handleSubmit, watch, formState: { errors } } = useForm();
  const level = watch('educationLevel', '');
  const showCourse = ['Senior High School', 'College', 'Post-Graduate'].includes(level);

  async function onSubmit(values) {
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(values).forEach(([k, v]) => fd.append(k, v));
      if (certFile) fd.append('educationCert', certFile);

      await api.post('/verification/step2', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      updateUser({ verificationStep: 2 });
      toast.success('Step 2 saved!');
      navigate('/verify/step3');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save step 2');
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
            <span className="font-extrabold text-xl text-primary">iRequestD</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Education Background</h1>
          <p className="text-gray-500 text-sm mt-1">Step 2 of 3 — Educational Attainment</p>
        </div>

        <StepProgress current={2} />

        <div className="card">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div>
              <label className="label">Highest Education Level</label>
              <select {...register('educationLevel', { required: 'Required' })} className="input-field">
                <option value="">Select education level</option>
                {EDUCATION_LEVELS.map((l) => <option key={l}>{l}</option>)}
              </select>
              {errors.educationLevel && <p className="text-red-500 text-xs mt-1">{errors.educationLevel.message}</p>}
            </div>

            <div>
              <label className="label">School Name</label>
              <input
                {...register('schoolName', { required: 'Required' })}
                className="input-field"
                placeholder="Name of school / university"
              />
              {errors.schoolName && <p className="text-red-500 text-xs mt-1">{errors.schoolName.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Graduation Year</label>
                <input
                  {...register('graduationYear', { required: 'Required', min: { value: 1950, message: 'Invalid year' } })}
                  type="number"
                  min="1950"
                  max={new Date().getFullYear()}
                  className="input-field"
                  placeholder="e.g. 2020"
                />
                {errors.graduationYear && <p className="text-red-500 text-xs mt-1">{errors.graduationYear.message}</p>}
              </div>
              {showCourse && (
                <div>
                  <label className="label">Course / Strand</label>
                  <input
                  {...register('course', {
                    validate: (v) => !v || !/\d/.test(v) || 'Course/Strand cannot contain numbers',
                  })}
                  className="input-field"
                  placeholder="e.g. BS Computer Science"
                  onKeyDown={(e) => { if (/\d/.test(e.key)) e.preventDefault(); }}
                />
                {errors.course && <p className="text-red-500 text-xs mt-1">{errors.course.message}</p>}
                </div>
              )}
            </div>

            <div>
              <label className="label">Education Certificate <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setCertFile(e.target.files[0])}
                className="input-field py-2 text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">Upload diploma, TOR, or school certificate</p>
            </div>

            <div className="flex gap-3 mt-2">
              <button type="button" onClick={() => navigate('/verify/step1')} className="btn-outline flex-1">
                ← Back
              </button>
              <button type="submit" disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
                {loading ? <LoadingSpinner size="sm" /> : 'Continue to Step 3 →'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
    </VerifyLayout>
  );
}
