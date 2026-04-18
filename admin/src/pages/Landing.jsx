import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FiDownload, FiBook, FiTrendingUp, FiMap,
  FiClipboard, FiHome, FiHeart,
  FiMapPin, FiClock, FiPhone, FiMail,
  FiBell, FiLock, FiFolder, FiWifi, FiZap, FiX,
} from 'react-icons/fi';
import assets from '../assets/cloudinaryAssets';

/* ─────────────────────────────────────────
   Modal
───────────────────────────────────────── */
function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative bg-[#0d1f0d] border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/5 h-[1.5px] bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent rounded-full" />
        <div className="p-8 pt-9">
          <div className="flex items-start justify-between mb-5">
            <h2 className="font-garamond text-2xl font-bold text-gold">{title}</h2>
            <button onClick={onClose} className="text-white/40 hover:text-white mt-0.5 ml-4">
              <FiX size={20} />
            </button>
          </div>
          <div className="text-white/70 text-sm leading-relaxed space-y-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Navbar
───────────────────────────────────────── */
function Navbar({ onContact }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileOpen(false);
  };

  return (
    <nav className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${scrolled ? 'bg-[#0d1f0d]/90 backdrop-blur-xl border-b border-white/10 shadow-lg' : 'bg-transparent'}`}>
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <img src={assets.DOLOGONLOGO} alt="logo" className="w-9 h-9 rounded-full object-cover border border-gold/40" />
          <span className="font-garamond text-lg font-bold text-gold">iRequestDologon</span>
        </div>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          {[['About', 'about'], ['Services', 'services'], ['Location', 'location']].map(([label, id]) => (
            <button key={id} onClick={() => scrollTo(id)}
              className="px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
              {label}
            </button>
          ))}
          <button onClick={onContact}
            className="px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
            Contact
          </button>
          <button onClick={() => scrollTo('download')}
            className="ml-2 flex items-center gap-2 px-4 py-2 text-sm font-semibold text-[#0d1f0d] bg-gold hover:bg-gold/90 rounded-lg transition-colors">
            <FiDownload size={14} />
            Download App
          </button>
        </div>

        {/* Mobile hamburger */}
        <button className="md:hidden text-white p-2" onClick={() => setMobileOpen(!mobileOpen)}>
          <div className={`w-5 h-0.5 bg-white mb-1 transition-all ${mobileOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
          <div className={`w-5 h-0.5 bg-white mb-1 transition-all ${mobileOpen ? 'opacity-0' : ''}`} />
          <div className={`w-5 h-0.5 bg-white transition-all ${mobileOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-[#0d1f0d]/95 backdrop-blur-xl border-t border-white/10 px-6 py-4 flex flex-col gap-2">
          {[['About', 'about'], ['Services', 'services'], ['Location', 'location'], ['Download', 'download']].map(([label, id]) => (
            <button key={id} onClick={() => scrollTo(id)}
              className="text-left px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 rounded-lg">
              {label}
            </button>
          ))}
          <button onClick={() => { onContact(); setMobileOpen(false); }}
            className="text-left px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 rounded-lg">
            Contact
          </button>
        </div>
      )}
    </nav>
  );
}

/* ─────────────────────────────────────────
   Icon wrapper used in cards
───────────────────────────────────────── */
function CardIcon({ icon: Icon, color = '#c9a84c' }) {
  return (
    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
      style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
      <Icon size={18} color={color} />
    </div>
  );
}

/* ─────────────────────────────────────────
   Main Landing Page
───────────────────────────────────────── */
export default function Landing() {
  const [modal, setModal] = useState(null);
  const [logoFlipped, setLogoFlipped] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setLogoFlipped((f) => !f), 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen text-white overflow-x-hidden">
      <Navbar onContact={() => setModal('contact')} />

      {/* ══════════════════════════════════════
          HERO SECTION
      ══════════════════════════════════════ */}
      <section className="relative min-h-screen flex items-center justify-center px-4 py-24">
        <video autoPlay muted loop playsInline
          className="absolute inset-0 w-full h-full object-cover z-[-2]" src={assets.BGVIDEO} />
        <div className="absolute inset-0 z-[-1] bg-gradient-to-b from-[#0a1f0a]/80 via-[#111811]/65 to-[#0a1f0a]/90" />
        <div className="absolute inset-0 z-[-1] pointer-events-none">
          <div className="absolute w-[500px] h-[500px] -top-32 -left-32 rounded-full bg-green-rich/30 blur-[100px] animate-pulse" />
          <div className="absolute w-[400px] h-[400px] -bottom-20 -right-20 rounded-full bg-green-accent/20 blur-[100px] animate-pulse [animation-delay:3s]" />
        </div>

        <div className="relative text-center w-full max-w-[500px] bg-[rgba(10,22,10,0.55)] backdrop-blur-[32px]
                        border border-white/10 rounded-[28px] px-10 py-14
                        shadow-[0_32px_80px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.10)]">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/5 h-[1.5px] bg-gradient-to-r from-transparent via-gold to-transparent rounded-full" />

          <div className="inline-flex items-center gap-2 bg-green-accent/10 border border-green-accent/25 rounded-full px-3.5 py-1.5 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-green-bright shadow-[0_0_6px_#3daa3d] animate-pulse" />
            <span className="text-white/50 text-[11px] tracking-widest uppercase">Online · Barangay Dologon</span>
          </div>

          <div className="w-[108px] h-[108px] mx-auto mb-6" style={{ perspective: '1000px' }}>
            <div className="relative w-full h-full transition-transform duration-[1600ms]"
              style={{ transformStyle: 'preserve-3d', transform: logoFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
              <div className="absolute inset-0 rounded-full overflow-hidden" style={{ backfaceVisibility: 'hidden' }}>
                <img src={assets.DOLOGONLOGO} alt="Dologon Logo"
                  className="w-full h-full object-cover rounded-full border-2 border-gold/60 shadow-[0_0_0_4px_rgba(201,168,76,0.12),0_8px_28px_rgba(0,0,0,0.5)]" />
              </div>
              <div className="absolute inset-0 rounded-full overflow-hidden"
                style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                <img src={assets.MARAMAGLOGO} alt="Maramag Logo"
                  className="w-full h-full object-cover rounded-full border-2 border-gold/60 shadow-[0_0_0_4px_rgba(201,168,76,0.12),0_8px_28px_rgba(0,0,0,0.5)]" />
              </div>
            </div>
          </div>

          <p className="text-[10px] font-medium tracking-[0.22em] uppercase text-gold-light/70 mb-2">
            Barangay Dologon · Maramag, Bukidnon
          </p>

          <h1 className="font-garamond text-[52px] font-bold leading-none tracking-tight mb-4">
            <span className="italic text-gold-light">i</span>
            <span className="text-white">Request</span>
            <span className="text-green-bright">Dologon</span>
          </h1>

          <div className="w-12 h-[1px] bg-gradient-to-r from-transparent via-gold to-transparent mx-auto mb-4" />

          <p className="text-white/50 text-[13px] font-light tracking-wide leading-relaxed mb-8">
            Official online portal for barangay document requests.<br />
            Fast, secure, and paperless.
          </p>

          <button onClick={() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })}
            className="flex flex-col items-center gap-1 mx-auto text-white/30 hover:text-white/60 transition-colors text-xs tracking-widest uppercase">
            <span>Discover More</span>
            <svg className="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </section>

      {/* ══════════════════════════════════════
          ABOUT SECTION
      ══════════════════════════════════════ */}
      <section id="about" className="relative py-24 px-4 bg-[#0d1f0d]">
        <div className="absolute inset-0 bg-cover bg-center opacity-5" style={{ backgroundImage: `url(${assets.BARANGAYHALL})` }} />
        <div className="relative max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[10px] tracking-[0.3em] uppercase text-gold/60 mb-2">Who We Are</p>
            <h2 className="font-garamond text-4xl md:text-5xl font-bold text-white mb-3">About Barangay Dologon</h2>
            <div className="w-12 h-[1px] bg-gradient-to-r from-transparent via-gold to-transparent mx-auto" />
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-center mb-14">
            <div>
              <img src={assets.BARANGAYHALL} alt="Barangay Hall"
                className="w-full rounded-2xl object-cover shadow-2xl border border-white/10" style={{ height: '280px' }} />
            </div>
            <div className="space-y-4 text-white/70 text-sm leading-relaxed">
              <p>
                <span className="text-gold font-semibold">Dologon</span> is a major, populous barangay in the
                municipality of Maramag, Bukidnon, with <span className="text-white font-medium">13,828 residents</span> (2020 Census),
                representing approximately 12.77% of the town's population.
              </p>
              <p>
                It is best known for hosting the <span className="text-white font-medium">Central Mindanao University (CMU)</span> in
                its Musuan area, making it a critical hub for education, agriculture, and local commerce.
              </p>
              <p>
                The barangay's motto: <span className="text-gold italic">"For the good of Dologon, We Serve and We Remain."</span>
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { value: '13,828', label: 'Residents', sub: '2020 Census' },
              { value: '12.77%', label: 'of Maramag', sub: 'Population share' },
              { value: '12', label: 'Puroks', sub: 'Subdivisions' },
              { value: '282–458m', label: 'Elevation', sub: 'Above sea level' },
            ].map(({ value, label, sub }) => (
              <div key={label} className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
                <p className="font-garamond text-3xl font-bold text-gold mb-1">{value}</p>
                <p className="text-white text-sm font-medium">{label}</p>
                <p className="text-white/40 text-xs mt-0.5">{sub}</p>
              </div>
            ))}
          </div>

          {/* Key facts */}
          <div className="grid md:grid-cols-3 gap-4 mt-6">
            {[
              { Icon: FiBook,       title: 'Education', body: 'Home to Central Mindanao University — the premier agricultural school in Mindanao, located in Sitio Musuan. Dologon National High School serves the local community.' },
              { Icon: FiTrendingUp, title: 'Economy',   body: 'Agriculture is dominant, with rural agri-based livelihood projects for residents and Indigenous Peoples (IPs) across the 12 puroks.' },
              { Icon: FiMap,        title: 'Landmarks', body: 'Musuan Peak is a prominent geographic feature known for its natural beauty. The CMU campus is a landmark destination in the area.' },
            ].map(({ Icon, title, body }) => (
              <div key={title} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <CardIcon icon={Icon} />
                <h3 className="text-white font-semibold mb-2">{title}</h3>
                <p className="text-white/55 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          SERVICES SECTION
      ══════════════════════════════════════ */}
      <section id="services" className="relative py-24 px-4 bg-[#091509]">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute w-[600px] h-[300px] top-0 left-1/2 -translate-x-1/2 bg-green-accent/5 blur-[80px]" />
        </div>
        <div className="relative max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[10px] tracking-[0.3em] uppercase text-gold/60 mb-2">What We Offer</p>
            <h2 className="font-garamond text-4xl md:text-5xl font-bold text-white mb-3">Our Services</h2>
            <div className="w-12 h-[1px] bg-gradient-to-r from-transparent via-gold to-transparent mx-auto mb-4" />
            <p className="text-white/50 text-sm max-w-md mx-auto">
              Request official barangay documents online and pick them up at the barangay office — no more long queues.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {[
              {
                Icon: FiClipboard,
                title: 'Barangay Clearance',
                desc: 'Required for employment, business permits, and other government transactions. Certifies that you have no pending case in the barangay.',
                fee: '₱130.00',
                time: '1–2 business days',
              },
              {
                Icon: FiHome,
                title: 'Certificate of Residency',
                desc: 'Proves that you are a bona fide resident of Barangay Dologon. Required for school enrollment, scholarships, and legal transactions.',
                fee: '₱130.00',
                time: '1–2 business days',
              },
              {
                Icon: FiHeart,
                title: 'Certificate of Indigency',
                desc: 'Certifies financial need for PhilHealth, educational assistance, and medical assistance programs. Free for qualified residents.',
                fee: 'Free / Exempt',
                time: '1–2 business days',
              },
            ].map(({ Icon, title, desc, fee, time }) => (
              <div key={title}
                className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/[0.08] hover:border-gold/30 transition-all duration-300 group">
                <CardIcon icon={Icon} />
                <h3 className="text-white font-semibold text-lg mb-2 group-hover:text-gold transition-colors">{title}</h3>
                <p className="text-white/55 text-sm leading-relaxed mb-5">{desc}</p>
                <div className="border-t border-white/10 pt-4 flex justify-between text-xs">
                  <span className="text-gold font-semibold">{fee}</span>
                  <span className="text-white/40">{time}</span>
                </div>
              </div>
            ))}
          </div>

          {/* How it works */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
            <h3 className="font-garamond text-2xl font-bold text-gold text-center mb-8">How It Works</h3>
            <div className="grid md:grid-cols-4 gap-6">
              {[
                { step: '01', title: 'Walk In',        desc: 'Visit the barangay office or inform the secretary of your document request.' },
                { step: '02', title: 'Submit Request', desc: 'The secretary encodes your information and submits the document request.' },
                { step: '03', title: 'Payment',        desc: 'Pay the document fee at the barangay collector\'s window.' },
                { step: '04', title: 'Pick Up',        desc: 'Once signed and sealed by the Barangay Captain, your document is ready for pickup.' },
              ].map(({ step, title, desc }) => (
                <div key={step} className="text-center">
                  <div className="w-12 h-12 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center mx-auto mb-3">
                    <span className="text-gold font-bold text-sm">{step}</span>
                  </div>
                  <h4 className="text-white font-semibold mb-1 text-sm">{title}</h4>
                  <p className="text-white/45 text-xs leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          LOCATION SECTION
      ══════════════════════════════════════ */}
      <section id="location" className="relative py-24 px-4 bg-[#0d1f0d]">
        <div className="absolute inset-0 bg-cover bg-center opacity-5" style={{ backgroundImage: `url(${assets.BG_MUSUAN})` }} />
        <div className="relative max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[10px] tracking-[0.3em] uppercase text-gold/60 mb-2">Find Us</p>
            <h2 className="font-garamond text-4xl md:text-5xl font-bold text-white mb-3">Location</h2>
            <div className="w-12 h-[1px] bg-gradient-to-r from-transparent via-gold to-transparent mx-auto" />
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-start">
            {/* Map embed */}
            <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
              <iframe
                title="Barangay Dologon Location"
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3934.034376929766!2d124.85487131534674!3d7.8406820940248865!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x32ff61c7a0b0c5f3%3A0x7b6c21c1dc3d1b0e!2sBarangay%20Dologon%2C%20Maramag%2C%20Bukidnon!5e0!3m2!1sen!2sph!4v1680000000000!5m2!1sen!2sph"
                width="100%" height="300" style={{ border: 0 }} allowFullScreen loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>

            {/* Info */}
            <div className="space-y-4">
              {[
                { Icon: FiMapPin, label: 'Address',      value: 'Barangay Dologon, Maramag, Bukidnon 8714, Philippines' },
                { Icon: FiClock,  label: 'Office Hours', value: 'Monday – Friday · 8:00 AM – 5:00 PM' },
                { Icon: FiPhone,  label: 'Contact',      value: 'Barangay Dologon Office' },
                { Icon: FiMail,   label: 'Email',        value: 'support@irequestdologon.gov.ph' },
              ].map(({ Icon, label, value }) => (
                <div key={label} className="flex gap-4 bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon size={14} color="#c9a84c" />
                  </div>
                  <div>
                    <p className="text-white/40 text-[11px] uppercase tracking-widest mb-0.5">{label}</p>
                    <p className="text-white/80 text-sm">{value}</p>
                  </div>
                </div>
              ))}

              <div className="bg-gold/10 border border-gold/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <FiMapPin size={14} color="#c9a84c" />
                  <p className="text-gold text-sm font-medium">Landmark</p>
                </div>
                <p className="text-white/60 text-sm">Near the Central Mindanao University (CMU) gate, Sitio Musuan area, Maramag, Bukidnon.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          DOWNLOAD SECTION
      ══════════════════════════════════════ */}
      <section id="download" className="relative py-24 px-4 bg-[#091509] overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute w-[500px] h-[500px] -top-40 left-1/2 -translate-x-1/2 rounded-full bg-gold/8 blur-[120px]" />
          <div className="absolute w-[300px] h-[300px] bottom-0 right-10 rounded-full bg-green-accent/10 blur-[100px]" />
        </div>

        <div className="relative max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[10px] tracking-[0.3em] uppercase text-gold/60 mb-2">Android Application</p>
            <h2 className="font-garamond text-4xl md:text-5xl font-bold text-white mb-3">
              Download <span className="text-gold italic">i</span>Request<span className="text-green-bright">Dologon</span>
            </h2>
            <div className="w-12 h-[1px] bg-gradient-to-r from-transparent via-gold to-transparent mx-auto mb-4" />
            <p className="text-white/50 text-sm max-w-lg mx-auto leading-relaxed">
              Take the barangay portal with you — install the official Android app and request
              documents directly from your phone, anytime, anywhere.
            </p>
          </div>

          <div className="flex flex-col lg:flex-row gap-8 items-stretch mb-12">

            {/* Left — branding + button */}
            <div className="flex-1 bg-white/5 border border-white/10 rounded-3xl p-8 flex flex-col items-center justify-center text-center
                            hover:border-gold/30 transition-all duration-300">
              <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-gold/40 shadow-[0_0_40px_rgba(201,168,76,0.2)] mb-5">
                <img src="https://res.cloudinary.com/dvw7ky1xq/image/upload/v1776177600/Irequest_Logo_kbbr2b.jpg" alt="App icon" className="w-full h-full object-cover" />
              </div>

              <h3 className="font-garamond text-2xl font-bold text-gold mb-1">iRequestDologon</h3>
              <p className="text-white/40 text-xs mb-1">Version 1.0.0 · Android APK</p>
              <p className="text-white/30 text-xs mb-6">Released April 2026 · ~25 MB</p>

              <a
                href="https://drive.google.com/uc?export=download&id=1OCRSRuU_GbTnmcuiFjT6cqZTpNHxUmWr"
                download
                className="inline-flex items-center gap-3 px-8 py-3.5 rounded-xl font-semibold text-[#0d1f0d] bg-gold hover:bg-gold/90
                           shadow-[0_4px_24px_rgba(201,168,76,0.35)] hover:shadow-[0_6px_32px_rgba(201,168,76,0.5)]
                           transition-all duration-300 active:scale-95 text-sm"
              >
                <FiDownload size={18} />
                Download for Android (.apk)
              </a>

              <p className="text-white/25 text-[11px] mt-4">Free · No account required to install</p>
            </div>

            {/* Right — feature list + requirements */}
            <div className="flex-1 flex flex-col gap-4">
              {/* Features */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-widest text-gold/80">What's Included</h4>
                <ul className="space-y-3">
                  {[
                    { Icon: FiClipboard,  text: 'Submit document requests without a browser' },
                    { Icon: FiBell,       text: 'Real-time status notifications on your phone' },
                    { Icon: FiLock,       text: 'Secure login — your data stays encrypted' },
                    { Icon: FiFolder,     text: 'View and track all your past requests in one place' },
                    { Icon: FiWifi,       text: 'Works even on slow internet connections' },
                    { Icon: FiZap,        text: 'Lightweight & fast — minimal system resources' },
                  ].map(({ Icon, text }) => (
                    <li key={text} className="flex items-start gap-3 text-sm text-white/65">
                      <div className="w-6 h-6 rounded-md bg-gold/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icon size={12} color="#c9a84c" />
                      </div>
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* System requirements */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-widest text-gold/80">System Requirements</h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {[
                    ['OS',      'Android 8.0 (Oreo) or higher'],
                    ['RAM',     '2 GB minimum'],
                    ['Storage', '50 MB free space'],
                    ['Network', 'Internet connection required'],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-white/5 rounded-xl px-3 py-2.5">
                      <p className="text-white/35 uppercase tracking-widest text-[10px] mb-0.5">{label}</p>
                      <p className="text-white/75">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Install steps */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
            <h4 className="font-garamond text-xl font-bold text-gold text-center mb-8">How to Install</h4>
            <div className="grid md:grid-cols-4 gap-6">
              {[
                { step: '01', title: 'Download',     desc: 'Tap the Download button above to save the APK file to your Android device.' },
                { step: '02', title: 'Allow Install', desc: 'Go to Settings → Security → enable "Install from Unknown Sources" for your browser.' },
                { step: '03', title: 'Open APK',     desc: 'Tap the downloaded .apk file from your notifications or Downloads folder.' },
                { step: '04', title: 'Request Docs', desc: 'Log in with your registered account and start submitting document requests.' },
              ].map(({ step, title, desc }) => (
                <div key={step} className="text-center">
                  <div className="w-12 h-12 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center mx-auto mb-3">
                    <span className="text-gold font-bold text-sm">{step}</span>
                  </div>
                  <h5 className="text-white font-semibold mb-1 text-sm">{title}</h5>
                  <p className="text-white/45 text-xs leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          FOOTER
      ══════════════════════════════════════ */}
      <footer className="bg-[#080f08] border-t border-white/10 py-10 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-3">
              <img src={assets.DOLOGONLOGO} alt="logo" className="w-10 h-10 rounded-full object-cover border border-gold/40" />
              <div>
                <p className="font-garamond text-lg font-bold text-gold leading-tight">iRequestDologon</p>
                <p className="text-white/30 text-xs">Barangay Dologon, Maramag, Bukidnon</p>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-white/30 text-xs">
              © {new Date().getFullYear()} Barangay Dologon LGU · iRequestDologon
            </p>
            <div className="flex items-center gap-4 text-xs text-white/30">
              <button onClick={() => setModal('privacy')} className="hover:text-white/60 transition-colors">Privacy Policy</button>
              <span>·</span>
              <button onClick={() => setModal('terms')} className="hover:text-white/60 transition-colors">Terms of Service</button>
              <span>·</span>
              <button onClick={() => setModal('contact')} className="hover:text-white/60 transition-colors">Contact Support</button>
            </div>
          </div>
        </div>
      </footer>

      {/* ══════════════════════════════════════
          MODALS
      ══════════════════════════════════════ */}
      <Modal open={modal === 'privacy'} onClose={() => setModal(null)} title="Privacy Policy">
        <p>The Barangay Dologon LGU respects your privacy. All personal information collected through iRequestDologon is handled securely in compliance with <strong className="text-white">Republic Act No. 10173</strong> (Data Privacy Act of 2012).</p>
        <div>
          <p className="text-white/90 font-medium mb-1">Information We Collect</p>
          <ul className="list-disc list-inside space-y-1 text-white/60">
            {['Full Name', 'Email Address', 'Contact Number', 'Purok / Address', 'Date of Birth', 'Civil Status', 'Uploaded supporting documents'].map(i => <li key={i}>{i}</li>)}
          </ul>
        </div>
        <div>
          <p className="text-white/90 font-medium mb-1">Your Rights</p>
          <ul className="list-disc list-inside space-y-1 text-white/60">
            {['Right to be informed', 'Right to access your data', 'Right to correct inaccurate data', 'Right to erasure of unlawfully processed data', 'Right to lodge a complaint with the NPC'].map(i => <li key={i}>{i}</li>)}
          </ul>
        </div>
        <div className="border-t border-white/10 pt-4 text-white/40 text-xs space-y-1">
          <p><strong className="text-white/60">Data Privacy Officer:</strong> Barangay Dologon LGU</p>
          <p><strong className="text-white/60">Address:</strong> Barangay Dologon, Maramag, Bukidnon (8714)</p>
          <p className="mt-2">Last updated: 2025 · Effective upon system use</p>
        </div>
      </Modal>

      <Modal open={modal === 'terms'} onClose={() => setModal(null)} title="Terms of Service">
        <p>By accessing iRequestDologon, you agree to comply with these terms established by Barangay Dologon LGU.</p>
        {[
          ['Lawful Use', 'The platform must be used only for legitimate barangay transactions. Misuse may be subject to legal action under applicable Philippine law.'],
          ['Accuracy of Information', 'Users must provide accurate and truthful information. Submission of false data may result in account suspension and referral to proper authorities.'],
          ['Account Responsibility', 'You are solely responsible for maintaining the confidentiality of your credentials.'],
          ['Intellectual Property', 'The iRequestDologon platform is the official property of Barangay Dologon LGU and may not be reproduced without prior written authorization.'],
          ['Amendments', 'Barangay Dologon LGU reserves the right to update these Terms at any time. Continued use constitutes acceptance of the revised terms.'],
        ].map(([heading, body]) => (
          <div key={heading}>
            <p className="text-white/90 font-medium mb-1">{heading}</p>
            <p>{body}</p>
          </div>
        ))}
        <p className="text-white/30 text-xs pt-2 border-t border-white/10">Last updated: 2025 · Effective upon system use</p>
      </Modal>

      <Modal open={modal === 'contact'} onClose={() => setModal(null)} title="Contact Support">
        <p>For technical concerns or inquiries regarding iRequestDologon, reach out through any of the channels below.</p>
        <div className="space-y-3">
          {[
            { label: 'Email Support',   value: 'support@irequestdologon.gov.ph' },
            { label: 'Barangay Office', value: 'Barangay Dologon, Maramag, Bukidnon (8714)' },
            { label: 'Office Hours',    value: 'Monday – Friday · 8:00 AM – 5:00 PM' },
            { label: 'Facebook Page',   value: 'Barangay Dologon Official' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white/5 rounded-xl px-4 py-3">
              <p className="text-white/40 text-[11px] uppercase tracking-widest mb-0.5">{label}</p>
              <p className="text-white/80 text-sm">{value}</p>
            </div>
          ))}
        </div>
        <p className="text-white/40 text-xs text-center pt-2">Response time is typically within 1–2 business days.</p>
      </Modal>
    </div>
  );
}
