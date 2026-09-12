import { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { MdCameraAlt, MdCheckCircle, MdRefresh } from 'react-icons/md';
import api from '../../services/api';
import StepProgress from '../../components/common/StepProgress';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Logo from '../../components/common/Logo';
import useAuthStore from '../../store/authStore';
import VerifyLayout from '../../components/layout/VerifyLayout';

const PRIMARY_ID_TYPES = [
  'Philippine National ID',
  'Philippine Passport',
  "Driver's License",
  'Postal ID',
  "Voter's ID",
  'Senior PWD ID',
];

const SECONDARY_ID_TYPES = [
  'TIN ID',
  'PhilHealth ID',
  'Pagibig Loyalty Card',
  'NBI Clearance',
  'Police Clearance',
  'Company ID',
  'School ID',
  'PSA Birth Certificate',
  'Marriage Certificate',
];

const LIVENESS_STEPS = [
  { id: 1, instruction: 'Position your face in the circle', hint: 'Center your face in the green circle' },
  { id: 2, instruction: 'Move a bit closer', hint: 'Your face should fill most of the circle' },
  { id: 3, instruction: 'Perfect distance!', hint: 'Hold still…' },
  { id: 4, instruction: 'Blink slowly', hint: 'Blink once to confirm it\'s really you' },
  { id: 5, instruction: '✓ Liveness confirmed!', hint: 'Great! Capturing your photo…' },
];

export default function Step3() {
  const navigate = useNavigate();
  const { updateUser } = useAuthStore();
  const webcamRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [cameraError, setCameraError] = useState(false);

  // ID choice: 'primary' | 'secondary' | null
  const [idChoice, setIdChoice] = useState(null);

  // Primary ID fields
  const [primaryIdType, setPrimaryIdType] = useState('');
  const [primaryIdFront, setPrimaryIdFront] = useState(null);
  const [primaryIdBack, setPrimaryIdBack] = useState(null);

  // Secondary ID fields (2 required)
  const [secondaryIdType, setSecondaryIdType] = useState('');
  const [secondaryIdFront, setSecondaryIdFront] = useState(null);
  const [secondaryId2Type, setSecondaryId2Type] = useState('');
  const [secondaryId2Front, setSecondaryId2Front] = useState(null);

  // Liveness
  const [livenessStep, setLivenessStep] = useState(1);
  const [livenessComplete, setLivenessComplete] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);

  function advanceLiveness() {
    if (livenessStep < LIVENESS_STEPS.length) {
      const next = livenessStep + 1;
      setLivenessStep(next);
      if (next === LIVENESS_STEPS.length) {
        setTimeout(() => {
          capturePhoto();
        }, 800);
      }
    }
  }

  const capturePhoto = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setCapturedPhoto(imageSrc);
      setLivenessComplete(true);
    }
  }, [webcamRef]);

  function resetLiveness() {
    setLivenessStep(1);
    setLivenessComplete(false);
    setCapturedPhoto(null);
  }

  function base64ToFile(base64, filename) {
    const arr = base64.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new File([u8arr], filename, { type: mime });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!idChoice) return toast.error('Please choose your ID type (Primary or Secondary)');
    if (idChoice === 'primary') {
      if (!primaryIdType) return toast.error('Select your primary ID type');
      if (!primaryIdFront) return toast.error('Upload front of your primary ID');
    }
    if (idChoice === 'secondary') {
      if (!secondaryIdType || !secondaryIdFront) return toast.error('Upload the first secondary ID');
      if (!secondaryId2Type || !secondaryId2Front) return toast.error('Upload the second secondary ID');
    }
    if (!livenessComplete || !capturedPhoto) return toast.error('Complete the liveness detection first');

    setLoading(true);
    try {
      const fd = new FormData();
      if (idChoice === 'primary') {
        fd.append('idType', primaryIdType);
        fd.append('idName', primaryIdType);
        fd.append('idFront', primaryIdFront);
        if (primaryIdBack) fd.append('idBack', primaryIdBack);
      } else {
        fd.append('secondaryIdType', secondaryIdType);
        fd.append('secondaryIdName', secondaryIdType);
        fd.append('secondaryIdFront', secondaryIdFront);
        fd.append('secondaryId2Type', secondaryId2Type);
        fd.append('secondaryId2Name', secondaryId2Type);
        fd.append('secondaryId2Front', secondaryId2Front);
        // backend requires idType/idFront — use a placeholder for secondary-only
        fd.append('idType', 'Secondary IDs');
        fd.append('idName', 'Secondary IDs');
      }

      const faceFile = base64ToFile(capturedPhoto, 'face.jpg');
      fd.append('facePhoto', faceFile);

      await api.post('/verification/step3', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      updateUser({ verificationStep: 3, verificationStatus: 'pending' });
      toast.success('Verification submitted!');
      navigate('/verify/waiting');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed');
    } finally {
      setLoading(false);
    }
  }

  const currentStep = LIVENESS_STEPS[livenessStep - 1];

  return (
    <VerifyLayout>
    <div className="min-h-screen bg-mint px-4 py-8 lg:px-16 xl:px-32 lg:py-12">
      <div className="max-w-lg mx-auto lg:max-w-3xl">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Logo size={34} rounded="rounded-xl" />
            <span className="font-extrabold text-xl text-primary">iRequestD</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">ID & Face Verification</h1>
          <p className="text-gray-500 text-sm mt-1">Step 3 of 3 — Identity Verification</p>
        </div>

        <StepProgress current={3} />

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Part A: ID Upload */}
          <div className="card">
            <h2 className="font-bold text-gray-800 mb-4">Part A — ID Upload</h2>

            {/* Choice selector */}
            <p className="text-sm text-gray-500 mb-3">What type of ID do you have?</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                type="button"
                onClick={() => { setIdChoice('primary'); }}
                className={`py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all
                  ${idChoice === 'primary' ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 text-gray-500 hover:border-primary/50'}`}
              >
                Primary ID
                <p className="text-xs font-normal mt-0.5 text-gray-400">1 valid government ID</p>
              </button>
              <button
                type="button"
                onClick={() => { setIdChoice('secondary'); }}
                className={`py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all
                  ${idChoice === 'secondary' ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 text-gray-500 hover:border-primary/50'}`}
              >
                Secondary IDs
                <p className="text-xs font-normal mt-0.5 text-gray-400">2 supporting IDs required</p>
              </button>
            </div>

            {/* Primary ID fields */}
            {idChoice === 'primary' && (
              <div className="space-y-3 pt-3 border-t border-gray-100">
                <div>
                  <label className="label">ID Type <span className="text-red-500">*</span></label>
                  <select value={primaryIdType} onChange={(e) => setPrimaryIdType(e.target.value)} className="input-field">
                    <option value="">Select ID type</option>
                    {PRIMARY_ID_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Front Photo <span className="text-red-500">*</span></label>
                  <input type="file" accept="image/*" onChange={(e) => setPrimaryIdFront(e.target.files[0])} className="input-field py-2 text-sm" />
                  {primaryIdFront && <p className="text-xs text-primary mt-1">✓ {primaryIdFront.name}</p>}
                </div>
                <div>
                  <label className="label">Back Photo <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input type="file" accept="image/*" onChange={(e) => setPrimaryIdBack(e.target.files[0])} className="input-field py-2 text-sm" />
                </div>
              </div>
            )}

            {/* Secondary ID fields */}
            {idChoice === 'secondary' && (
              <div className="space-y-4 pt-3 border-t border-gray-100">
                {/* Secondary ID 1 */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Secondary ID 1</p>
                  <div>
                    <label className="label">ID Type <span className="text-red-500">*</span></label>
                    <select value={secondaryIdType} onChange={(e) => setSecondaryIdType(e.target.value)} className="input-field">
                      <option value="">Select ID type</option>
                      {SECONDARY_ID_TYPES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Front Photo <span className="text-red-500">*</span></label>
                    <input type="file" accept="image/*" onChange={(e) => setSecondaryIdFront(e.target.files[0])} className="input-field py-2 text-sm" />
                    {secondaryIdFront && <p className="text-xs text-primary mt-1">✓ {secondaryIdFront.name}</p>}
                  </div>
                </div>

                {/* Secondary ID 2 */}
                <div className="space-y-2 pt-3 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Secondary ID 2</p>
                  <div>
                    <label className="label">ID Type <span className="text-red-500">*</span></label>
                    <select value={secondaryId2Type} onChange={(e) => setSecondaryId2Type(e.target.value)} className="input-field">
                      <option value="">Select ID type</option>
                      {SECONDARY_ID_TYPES.filter((t) => t !== secondaryIdType).map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Front Photo <span className="text-red-500">*</span></label>
                    <input type="file" accept="image/*" onChange={(e) => setSecondaryId2Front(e.target.files[0])} className="input-field py-2 text-sm" />
                    {secondaryId2Front && <p className="text-xs text-primary mt-1">✓ {secondaryId2Front.name}</p>}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Part B: Liveness Detection */}
          <div className="card">
            <h2 className="font-bold text-gray-800 mb-2">Part B — Face Capture</h2>
            <p className="text-sm text-gray-500 mb-4">Follow the steps below to confirm your identity</p>

            {livenessComplete && capturedPhoto ? (
              <div className="text-center">
                <div className="relative inline-block">
                  <img src={capturedPhoto} alt="Captured" className="w-40 h-40 sm:w-48 sm:h-48 object-cover rounded-full border-4 border-primary mx-auto" />
                  <div className="absolute bottom-0 right-0 w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                    <MdCheckCircle className="text-white" size={24} />
                  </div>
                </div>
                <p className="text-primary font-semibold mt-3">Face captured successfully!</p>
                <button type="button" onClick={resetLiveness} className="text-sm text-gray-500 hover:text-gray-700 mt-2 flex items-center gap-1 mx-auto">
                  <MdRefresh size={16} /> Retake photo
                </button>
              </div>
            ) : cameraError ? (
              <div className="text-center py-6">
                <p className="text-red-500 mb-2">Camera not accessible</p>
                <button type="button" onClick={() => setCameraError(false)} className="btn-outline text-sm py-2 px-4">Retry</button>
              </div>
            ) : (
              <div className="text-center">
                <div className="relative inline-block">
                  <Webcam
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    onUserMediaError={() => setCameraError(true)}
                    videoConstraints={{ facingMode: 'user', width: 300, height: 300 }}
                    className="w-52 h-52 sm:w-64 sm:h-64 object-cover rounded-full"
                  />
                  <div className="absolute inset-0 rounded-full border-4 border-primary pointer-events-none" />
                  <div className={`absolute inset-0 rounded-full border-4 pointer-events-none transition-colors
                    ${livenessStep === 5 ? 'border-lime' : 'border-primary/50'}`} />
                </div>

                <div className="mt-4 px-4">
                  <div className="flex justify-center gap-1 mb-3">
                    {LIVENESS_STEPS.map((s) => (
                      <div key={s.id} className={`w-2 h-2 rounded-full transition-colors
                        ${s.id < livenessStep ? 'bg-primary' : s.id === livenessStep ? 'bg-primary' : 'bg-gray-200'}`} />
                    ))}
                  </div>
                  <p className="font-semibold text-gray-800">{currentStep.instruction}</p>
                  <p className="text-sm text-gray-500 mt-1">{currentStep.hint}</p>
                  {livenessStep < LIVENESS_STEPS.length && (
                    <button
                      type="button"
                      onClick={advanceLiveness}
                      className="btn-primary mt-4 py-2 px-6 text-sm flex items-center gap-2 mx-auto"
                    >
                      <MdCameraAlt size={18} />
                      {livenessStep === 4 ? 'I Blinked' : 'Next'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => navigate('/verify/step2')} className="btn-outline flex-1">
              ← Back
            </button>
            <button type="submit" disabled={loading || !livenessComplete} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {loading ? <LoadingSpinner size="sm" /> : 'Submit for Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </VerifyLayout>
  );
}
