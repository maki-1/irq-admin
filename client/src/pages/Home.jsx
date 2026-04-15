import { Link } from 'react-router-dom';
import Navbar from '../components/layouts/Navbar';

export default function Home() {
  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Background video */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className="fixed inset-0 w-full h-full object-cover z-[-2]"
        src="/DOLOGONBGVIDEO.mp4"
      />
      <div className="fixed inset-0 bg-green-rich/60 z-[-1]" />

      <Navbar />

      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20">
        <img src="/DOLOGONLOGO.jpg" alt="Barangay Dologon" className="w-28 h-28 rounded-full object-cover mb-6 border-4 border-gold shadow-lg" />
        <h1 className="font-garamond text-5xl md:text-6xl font-bold text-gold mb-4">
          iRequestDologon
        </h1>
        <p className="text-white/80 max-w-xl text-lg mb-10">
          Your online portal for requesting official barangay documents — fast, easy, and secure.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link to="/register" className="btn-primary text-lg px-8 py-3 rounded-xl">
            Get Started
          </Link>
          <Link to="/login" className="btn-secondary text-lg px-8 py-3 rounded-xl">
            Sign In
          </Link>
        </div>

        {/* Services preview */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl w-full">
          {['Barangay Clearance', 'Certificate of Residency', 'Certificate of Indigency'].map((doc) => (
            <div key={doc} className="card text-left">
              <div className="w-8 h-8 rounded-full bg-gold mb-3" />
              <h3 className="font-semibold text-white mb-1">{doc}</h3>
              <p className="text-white/60 text-sm">Request online and pick up at the barangay office.</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
