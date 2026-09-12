import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MdArrowForward, MdArrowBack, MdVerified, MdSpeed, MdTrackChanges } from 'react-icons/md';
import { HiOutlineDocumentText } from 'react-icons/hi';
import PublicLayout from '../../components/layout/PublicLayout';

const SLIDES = [
  {
    icon: HiOutlineDocumentText,
    title: 'Welcome to iRequestD',
    subtitle: 'Your Barangay, Digitized',
    desc: 'Request official barangay documents online — anytime, anywhere. No long lines, no wasted trips.',
    color: 'from-primary to-green-700',
  },
  {
    icon: MdSpeed,
    title: 'Fast & Easy',
    subtitle: 'Done in Minutes',
    desc: 'Fill out a simple form, submit your request, and receive your document at the barangay hall — no hassle.',
    color: 'from-green-600 to-teal-700',
  },
  {
    icon: MdVerified,
    title: 'Secure Verification',
    subtitle: 'Your Identity, Protected',
    desc: 'We use a KYC process with ID verification and face capture to ensure only real residents can request documents.',
    color: 'from-teal-600 to-primary',
  },
  {
    icon: MdTrackChanges,
    title: 'Track in Real-Time',
    subtitle: 'Stay in the Know',
    desc: 'Monitor your request status live — from submission to Ready for Pickup. Get your claim code when it\'s ready.',
    color: 'from-primary to-green-800',
  },
];

export default function Landing() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setCurrent((c) => (c + 1) % SLIDES.length), 5000);
    return () => clearInterval(timer);
  }, []);

  const slide = SLIDES[current];
  const Icon = slide.icon;

  return (
    <PublicLayout>
      <div className="min-h-[calc(100vh-64px)] flex flex-col">
        {/* Hero Carousel */}
        <div className={`flex-1 bg-gradient-to-br ${slide.color} relative flex flex-col items-center justify-center px-6 py-10 sm:py-16 overflow-hidden transition-all duration-700`}>
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-10">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full bg-white"
                style={{
                  width: Math.random() * 80 + 20,
                  height: Math.random() * 80 + 20,
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                  transform: 'translate(-50%,-50%)',
                }}
              />
            ))}
          </div>

          <div className="relative z-10 max-w-lg w-full text-center">
            <div className="w-24 h-24 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-6 backdrop-blur-sm">
              <Icon size={52} className="text-white" />
            </div>
            <div className="inline-block bg-white/20 text-white text-sm font-semibold px-4 py-1.5 rounded-full mb-4 backdrop-blur-sm">
              {slide.subtitle}
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-4 leading-tight">
              {slide.title}
            </h1>
            <p className="text-white/90 text-lg leading-relaxed mb-10">{slide.desc}</p>

            {/* Slide dots */}
            <div className="flex justify-center gap-2 mb-8">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`rounded-full transition-all duration-300 ${i === current ? 'w-6 h-2 bg-white' : 'w-2 h-2 bg-white/50'}`}
                />
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/signup" className="bg-white text-primary font-bold py-3 px-8 rounded-xl hover:bg-gray-50 active:scale-95 transition-all flex items-center justify-center gap-2">
                Get Started <MdArrowForward size={20} />
              </Link>
              <Link to="/login" className="border-2 border-white text-white font-bold py-3 px-8 rounded-xl hover:bg-white/10 active:scale-95 transition-all text-center">
                Login
              </Link>
            </div>
          </div>

          {/* Prev/Next arrows — hidden on small phones to avoid crowding the slide text; dots + autoplay still work */}
          <button
            onClick={() => setCurrent((c) => (c - 1 + SLIDES.length) % SLIDES.length)}
            className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full items-center justify-center text-white transition-colors"
          >
            <MdArrowBack size={20} />
          </button>
          <button
            onClick={() => setCurrent((c) => (c + 1) % SLIDES.length)}
            className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full items-center justify-center text-white transition-colors"
          >
            <MdArrowForward size={20} />
          </button>
        </div>

        {/* Feature strip */}
        <div className="bg-white border-t border-gray-100 px-6 py-8">
          <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 divide-y sm:divide-y-0 divide-gray-100 text-center">
            {[
              { label: 'Barangay Clearance', desc: 'For employment & legal needs' },
              { label: 'Certificate of Residency', desc: 'Proof of address in barangay' },
              { label: 'Certificate of Indigency', desc: 'For financial assistance' },
            ].map((item) => (
              <div key={item.label} className="pt-3 first:pt-0 sm:pt-0">
                <p className="font-bold text-gray-800 text-sm md:text-base">{item.label}</p>
                <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Skip link */}
        <div className="text-center py-4 bg-gray-50">
          <Link to="/login" className="text-sm text-gray-500 hover:text-primary underline">
            Already have an account? Skip →
          </Link>
        </div>
      </div>
    </PublicLayout>
  );
}
