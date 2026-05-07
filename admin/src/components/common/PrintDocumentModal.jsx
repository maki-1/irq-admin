import { useEffect } from 'react';
import { logAction } from '../../services/audit.service';

const DOLOGON_LOGO  = 'https://res.cloudinary.com/dvw7ky1xq/image/upload/v1776233357/irequestdologon/assets/DOLOGONLOGO.jpg';
const MARAMAG_LOGO  = 'https://res.cloudinary.com/dvw7ky1xq/image/upload/v1776233358/irequestdologon/assets/MARAMAGLOGO.jpg';

const SIG_CAPTAIN   = 'https://res.cloudinary.com/dvw7ky1xq/image/upload/v1778144373/michael_qzm39g.png';
const SIG_SECRETARY = 'https://res.cloudinary.com/dvw7ky1xq/image/upload/v1778144372/Godsent_bvn2ur.png';
const SIG_TREASURER = 'https://res.cloudinary.com/dvw7ky1xq/image/upload/v1778088798/Signature_k7he8f.png';
const BRGY_STAMP    = 'https://res.cloudinary.com/dvw7ky1xq/image/upload/v1778144665/483f4805-8a92-4fc6-beaa-79f532f07913-removebg-preview_qli5ty.png';

/* ─── Shared header ─────────────────────────────────────────── */
function DocHeader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 6 }}>
      <img src={DOLOGON_LOGO} alt="Dologon seal" style={{ width: 70, height: 70, objectFit: 'contain' }} />
      <div style={{ textAlign: 'center', lineHeight: 1.35 }}>
        <p style={{ fontStyle: 'italic', fontSize: 10 }}>Republic of the Philippines</p>
        <p style={{ fontWeight: 'bold', fontStyle: 'italic', fontSize: 11 }}>PROVINCE OF BUKIDNON</p>
        <p style={{ fontStyle: 'italic', fontSize: 10 }}>Municipality of Maramag</p>
        <p style={{ fontWeight: 'bold', fontStyle: 'italic', fontSize: 11 }}>BARANGAY OF DOLOGON</p>
      </div>
      <img src={MARAMAG_LOGO} alt="Maramag seal" style={{ width: 70, height: 70, objectFit: 'contain' }} />
    </div>
  );
}

/* ─── Office title bar ──────────────────────────────────────── */
function OfficeBanner() {
  return (
    <>
      <div style={{
        background: '#FFD700',
        textAlign: 'center',
        padding: '4px 0',
        fontWeight: 'bold',
        fontSize: 13,
        letterSpacing: 1,
        marginBottom: 2,
      }}>
        OFFICE OF THE PUNONG BARANGAY
      </div>
      <div style={{ borderTop: '3px solid #000', borderBottom: '1px solid #000', marginBottom: 14 }} />
    </>
  );
}

/* ─── Blank field line ──────────────────────────────────────── */
function Blank({ value, width = 120, inline = true }) {
  const style = {
    display: inline ? 'inline-block' : 'block',
    borderBottom: '1px solid #000',
    minWidth: width,
    textAlign: 'center',
    fontWeight: 'normal',
    verticalAlign: 'bottom',
    paddingBottom: 1,
  };
  return <span style={style}>{value || ' '}</span>;
}

/* ─── Digital signature block (PNPKI-style) ─────────────────── */
function Sig({ name, title, sigUrl, align = 'center' }) {
  const now = new Date();
  const ts  = `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')} `
             +`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')} +08'00'`;
  return (
    <div style={{ textAlign: align, display: 'inline-block', minWidth: 190 }}>
      <div style={{
        border: '1px solid #aaa',
        borderRadius: 3,
        padding: '4px 6px',
        marginBottom: 4,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: '#fff',
      }}>
        <img
          src={sigUrl}
          alt="signature"
          style={{ width: 72, height: 52, objectFit: 'contain', flexShrink: 0 }}
        />
        <div style={{ textAlign: 'left', fontSize: 7.5, lineHeight: 1.6, color: '#111' }}>
          <div style={{ fontWeight: 'bold' }}>Digitally signed by</div>
          <div style={{ fontWeight: 'bold' }}>{name}</div>
          <div>Date: {ts}</div>
        </div>
      </div>
      <p style={{ fontWeight: 'bold', textDecoration: 'underline', margin: '2px 0 0' }}>{name}</p>
      <p style={{ margin: 0, fontSize: 10 }}>{title}</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   DOCUMENT TEMPLATES
══════════════════════════════════════════════════════════════ */

function BarangayClearance({ req, name, age, purok, day, monthYear }) {
  const paymentDate = req.updatedAt
    ? new Date(req.updatedAt).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
    : '';
  const orAmount = req.amountPaid ? `Php ${Number(req.amountPaid).toFixed(2)}` : '';

  return (
    <div style={docStyle}>
      <DocHeader />
      <OfficeBanner />

      <h2 style={{ textAlign: 'center', textDecoration: 'underline', letterSpacing: 3, fontSize: 16, marginBottom: 20 }}>
        BARANGAY&nbsp; C L E A R A N C E
      </h2>

      <p style={toWhomStyle}>TO WHOM IT MAY CONCERN:</p>

      <p style={paraStyle}>
        &emsp;This is to certify that <Blank value={name} width={160} />, <Blank value={age} width={40} /> years of age,{' '}
        <Blank value={name} width={160} /> is a bona fide resident of Purok{' '}
        <Blank value={purok} width={40} /> Dologon, Maramag, Bukidnon has no derogatory records as
        per record on file at this office.
      </p>

      <p style={paraStyle}>
        &emsp;That the above-named person has no pending case filed in the Lupon Tagapamayapa.
      </p>

      <p style={paraStyle}>
        &emsp;This certification is issued upon the request of subject person for{' '}
        <strong>"{req.purpose || 'WORK IMMERSION'}"</strong> purposes.
      </p>

      <p style={{ ...paraStyle, marginTop: 16 }}>
        &emsp;Issued this <Blank value={day} width={30} /> day of{' '}
        <Blank value={monthYear} width={130} /> at the Administration Hall, Dologon, Maramag, Bukidnon.
      </p>

      {/* Payment / CTC table */}
      <div style={{ display: 'flex', gap: 40, marginTop: 20, fontSize: 10 }}>
        <div style={{ flex: 1 }}>
          <p style={metaRow}>Paid under OR No. : <Blank value={req.orNumber} width={80} /></p>
          <p style={metaRow}>Issued on &emsp;&emsp;&emsp;&ensp;: <Blank value={paymentDate} width={120} /></p>
          <p style={metaRow}>Issued at &emsp;&emsp;&emsp;&ensp;: <Blank value="Dologon, Maramag, Bukidnon" width={160} /></p>
          <p style={metaRow}>Amount &emsp;&emsp;&emsp;&emsp;&nbsp;: <Blank value={orAmount} width={80} /></p>
        </div>
        <div style={{ flex: 1 }}>
          <p style={metaRow}>CTC No. &nbsp;: <Blank value="" width={80} /></p>
          <p style={metaRow}>Issued on : <Blank value="" width={80} /></p>
          <p style={metaRow}>Issued at &nbsp;: <Blank value="" width={80} /></p>
          <p style={metaRow}>Amount &nbsp;: Php 105.00</p>
        </div>
      </div>

      {/* Signatures */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 30, alignItems: 'flex-end' }}>
        <Sig name="CECILIA D. PADERNAL"    title="Barangay Treasurer" sigUrl={SIG_TREASURER} align="center" />
        <Sig name="GOD SENT GRACE S. LABO" title="Barangay Secretary" sigUrl={SIG_SECRETARY} align="center" />
      </div>
      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <Sig name="MICHAEL C. RITARDO" title="Punong Barangay" sigUrl={SIG_CAPTAIN} align="center" />
      </div>

      <img src={BRGY_STAMP} alt="Barangay stamp" style={{ width: 140, height: 140, objectFit: 'contain', marginTop: 30, opacity: 0.85 }} />
    </div>
  );
}

function CertificateOfIndigency({ req, name, age, purok, day, monthYear }) {
  const issuedOn = req.updatedAt
    ? new Date(req.updatedAt).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
    : '';
  const orAmount = req.amountPaid ? `Php ${Number(req.amountPaid).toFixed(2)}` : 'FREE';

  return (
    <div style={docStyle}>
      <DocHeader />
      <OfficeBanner />

      <h2 style={{ textAlign: 'center', textDecoration: 'underline', letterSpacing: 2, fontSize: 15, marginBottom: 20 }}>
        CERTIFICATION OF INDIGENCY
      </h2>

      <p style={toWhomStyle}>TO WHOM IT MAY CONCERN:</p>

      <p style={paraStyle}>
        &emsp;THIS IS TO CERTIFY that <Blank value={name} width={160} />,{' '}
        <Blank value={age} width={40} /> years of age, <Blank value={name} width={160} />,
        is a bona fide resident of Purok <Blank value={purok} width={40} /> Dologon, Maramag, Bukidnon.
      </p>

      <p style={paraStyle}>
        &emsp;This certifies further that <Blank value={name} width={160} /> has no permanent
        source of income and belongs to the indigent family of this barangay.
      </p>

      <p style={paraStyle}>
        &emsp;This certification is issued upon the request of the above-mentioned person for{' '}
        <strong>"{req.purpose || 'PHILHEALTH'}"</strong> purposes.
      </p>

      <p style={{ ...paraStyle, marginTop: 16 }}>
        &emsp;Issued this <Blank value={day} width={30} /> day of{' '}
        <Blank value={monthYear} width={130} /> at the Administration Hall, Dologon, Maramag, Bukidnon.
      </p>

      <div style={{ textAlign: 'right', marginTop: 36 }}>
        <Sig name="MICHAEL C. RITARDO" title="Punong Barangay" sigUrl={SIG_CAPTAIN} align="center" />
      </div>

      {/* OR / CTC section */}
      <div style={{ fontSize: 10, marginTop: 30 }}>
        <p style={metaRow}>OR No. &emsp;&emsp;: <Blank value={req.orNumber} width={80} /></p>
        <p style={metaRow}>Amount &emsp;&nbsp;: <Blank value={orAmount} width={80} /></p>
        <p style={metaRow}>CTC No. &emsp;: <Blank value="" width={80} /></p>
        <p style={metaRow}>Amount &emsp;&nbsp;: <Blank value="" width={80} /></p>
        <p style={metaRow}>Issued on &nbsp;: <Blank value={issuedOn} width={140} /></p>
        <p style={metaRow}>Issued at &nbsp;&nbsp;: <Blank value="Dologon, Maramag, Bukidnon" width={160} /></p>
      </div>

      <img src={BRGY_STAMP} alt="Barangay stamp" style={{ width: 140, height: 140, objectFit: 'contain', marginTop: 24, opacity: 0.85 }} />
    </div>
  );
}

function CertificateOfResidency({ req, name, age, purok, day, monthYear }) {
  const years = req.yearsAtAddress
    ? `${req.yearsAtAddress} year${req.yearsAtAddress !== 1 ? 's' : ''}`
    : null;

  return (
    <div style={docStyle}>
      <DocHeader />
      <OfficeBanner />

      <h2 style={{ textAlign: 'center', textDecoration: 'underline', letterSpacing: 2, fontSize: 15, marginBottom: 20 }}>
        CERTIFICATE OF RESIDENCY
      </h2>

      <p style={toWhomStyle}>TO WHOM IT MAY CONCERN:</p>

      <p style={paraStyle}>
        &emsp;THIS IS TO CERTIFY that <Blank value={name} width={160} />,{' '}
        <Blank value={age} width={40} /> years of age, <Blank value={name} width={160} />{' '}
        is a bona fide resident of Purok <Blank value={purok} width={40} /> Dologon, Maramag, Bukidnon.
      </p>

      <p style={paraStyle}>
        &emsp;This certifies further that <Blank value={name} width={160} /> is living in the
        barangay for <Blank value={years} width={70} /> now, of good moral character, and has
        no criminal record in the barangay.
      </p>

      <p style={paraStyle}>
        &emsp;This certification is issued upon the request of the above-named person for{' '}
        <strong>"{req.purpose || 'IDENTIFICATION'}"</strong> purposes.
      </p>

      <p style={{ ...paraStyle, marginTop: 16 }}>
        &emsp;Issued this <Blank value={day} width={30} /> day of{' '}
        <Blank value={monthYear} width={130} /> at the Administration Hall, Dologon, Maramag, Bukidnon.
      </p>

      <div style={{ textAlign: 'right', marginTop: 36 }}>
        <Sig name="MICHAEL C. RITARDO" title="Punong Barangay" sigUrl={SIG_CAPTAIN} align="center" />
      </div>

      <img src={BRGY_STAMP} alt="Barangay stamp" style={{ width: 140, height: 140, objectFit: 'contain', marginTop: 40, opacity: 0.85 }} />
    </div>
  );
}

/* ─── Shared inline styles ──────────────────────────────────── */
const docStyle = {
  width: '210mm',
  minHeight: '297mm',
  padding: '18mm 20mm',
  background: '#fff',
  color: '#000',
  fontFamily: "'Times New Roman', Times, serif",
  fontSize: 12,
  boxSizing: 'border-box',
  flexShrink: 0,
};

const toWhomStyle = {
  fontWeight: 'bold',
  fontSize: 12,
  marginBottom: 10,
  marginTop: 4,
};

const paraStyle = {
  textAlign: 'justify',
  lineHeight: 1.8,
  marginBottom: 10,
};

const metaRow = {
  margin: '1px 0',
  lineHeight: 1.6,
};

/* ─── Router ────────────────────────────────────────────────── */
function Document({ request }) {
  const date      = new Date(request.createdAt);
  const day       = date.getDate();
  const monthYear = date.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });

  const vp      = request.profile || {};
  const name    = vp.fullName || request.user?.username || '';
  const age     = vp.age      ?? '';
  const address = vp.address  || '';

  // Extract purok: split address by comma, take first segment, strip "Purok " prefix
  const firstSeg   = address.split(',')[0].trim();                   // e.g. "Purok 5"
  const purokMatch = firstSeg.match(/^Purok\s+(.+)$/i);
  const purok      = vp.purok || (purokMatch ? purokMatch[1].trim() : firstSeg);

  const props = { req: request, name, age, purok, address, day, monthYear };

  switch (request.documentType) {
    case 'Barangay Clearance':
      return <BarangayClearance {...props} />;
    case 'Certificate of Indigency':
      return <CertificateOfIndigency {...props} />;
    case 'Certificate of Residency':
      return <CertificateOfResidency {...props} />;
    default:
      return <div style={docStyle}>Unsupported document type: {request.documentType}</div>;
  }
}

/* ─── Modal shell ───────────────────────────────────────────── */
export default function PrintDocumentModal({ request, onClose }) {
  useEffect(() => {
    const residentName = request?.profile?.fullName || request?.user?.username || '—';
    logAction('Printed Document', `Resident: ${residentName}, Type: ${request?.documentType}`).catch(() => {});
    window.addEventListener('afterprint', onClose);
    const timer = setTimeout(() => window.print(), 100);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('afterprint', onClose);
    };
  }, [onClose]);

  return (
    <div className="print-only">
      <Document request={request} />
    </div>
  );
}
