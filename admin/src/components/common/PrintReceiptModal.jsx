import { useRef } from 'react';
import { FiX, FiPrinter } from 'react-icons/fi';
import useAuthStore from '../../store/authStore';

const PH_SEAL  = 'https://res.cloudinary.com/dvw7ky1xq/image/upload/v1778072706/Logo_ng_ph_qbmmwv.png';
const BUK_SEAL = 'https://res.cloudinary.com/dvw7ky1xq/image/upload/v1778072846/province_iw77nm.png';

/* ── Amount-to-words helper ── */
const ONES = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
               'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen',
               'Seventeen','Eighteen','Nineteen'];
const TENS = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];

function belowThousand(n) {
  if (n === 0) return '';
  if (n < 20)  return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  return ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + belowThousand(n % 100) : '');
}

function amountToWords(amount) {
  if (!amount || amount === 0) return 'Zero Pesos Only';
  const pesos    = Math.floor(amount);
  const centavos = Math.round((amount - pesos) * 100);
  let words = '';
  if (pesos >= 1_000_000) {
    words += belowThousand(Math.floor(pesos / 1_000_000)) + ' Million ';
  }
  if (pesos >= 1_000) {
    words += belowThousand(Math.floor((pesos % 1_000_000) / 1_000)) + ' Thousand ';
  }
  words += belowThousand(pesos % 1_000);
  words = words.trim() + ' Pesos';
  if (centavos > 0) {
    words += ' and ' + belowThousand(centavos) + '/100';
  }
  return words + ' Only';
}

/* ── The actual form document ── */
function ReceiptDocument({ req, residentName, officerName }) {
  const date    = new Date(req.updatedAt || req.createdAt);
  const dateStr = date.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  const amount  = req.amountPaid || 0;

  const cell = (extra = {}) => ({
    border: '1px solid #000',
    padding: '3px 6px',
    fontSize: 11,
    ...extra,
  });

  return (
    <div id="receipt-print-area" style={{
      width: '100%',
      fontFamily: "'Times New Roman', Times, serif",
      fontSize: 11,
      color: '#000',
      background: '#fff',
      padding: '16px 20px',
    }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10,
        border: '1.5px solid #000',
        borderRadius: 12,
        padding: '8px 10px',
      }}>
        <img src={PH_SEAL}  alt="" style={{ width: 52, height: 52, objectFit: 'contain' }} />
        <div style={{ textAlign: 'center', flex: 1, lineHeight: 1.35 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 'normal' }}>OFFICIAL RECEIPT</p>
          <p style={{ margin: 0, fontSize: 10 }}>Republic of the Philippines</p>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 'bold', letterSpacing: 0.5 }}>PROVINCE OF BUKIDNON</p>
          <p style={{ margin: 0, fontSize: 9.5 }}>Office of the Provincial Treasurer</p>
        </div>
        <img src={BUK_SEAL} alt="" style={{ width: 52, height: 52, objectFit: 'contain' }} />
      </div>

      {/* ── Form title strip ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginBottom: 0 }}>
        <tbody>
          <tr>
            <td style={{ ...cell(), width: '55%', fontSize: 10, lineHeight: 1.4 }}>
              <strong>Accountable Form No. 51</strong><br />
              (Revised June 2008)
            </td>
            <td style={{ ...cell(), textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 'bold', letterSpacing: 2 }}>ORIGINAL</div>
              {req.orNumber && (
                <div style={{ fontSize: 11, fontWeight: 'bold', color: '#800000', letterSpacing: 1, marginTop: 2 }}>
                  No. {req.orNumber}
                </div>
              )}
              {req.paymentLinkId && (
                <div style={{ fontSize: 13, fontWeight: 'bold', color: '#cc0000', letterSpacing: 1, marginTop: 2 }}>
                  {req.paymentLinkId}
                </div>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Date ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: 'none', border: '1px solid #000', marginTop: -1 }}>
        <tbody>
          <tr>
            <td style={{ ...cell(), borderTop: 'none', fontSize: 10 }}>
              <span style={{ fontVariant: 'small-caps', fontSize: 10, color: '#555' }}>Date</span>
              <span style={{ marginLeft: 12, fontWeight: 'bold' }}>{dateStr}</span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Agency + Fund ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginTop: -1 }}>
        <tbody>
          <tr>
            <td style={{ ...cell({ borderTop: 'none' }), width: '65%' }}>
              <span style={{ fontVariant: 'small-caps', fontSize: 10, color: '#555' }}>Agency</span>
              <span style={{ marginLeft: 8, fontWeight: 'bold', fontSize: 12 }}>B.T. Dologon</span>
            </td>
            <td style={{ ...cell({ borderTop: 'none', borderLeft: '1px solid #000' }), width: '35%' }}>
              <span style={{ fontVariant: 'small-caps', fontSize: 10, color: '#555' }}>Fund</span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Payor ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginTop: -1 }}>
        <tbody>
          <tr>
            <td style={{ ...cell({ borderTop: 'none' }) }}>
              <span style={{ fontVariant: 'small-caps', fontSize: 10, color: '#555' }}>Payor</span>
              <span style={{ marginLeft: 16, fontWeight: 'bold', fontSize: 12 }}>{residentName}</span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Collection table ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginTop: -1 }}>
        <thead>
          <tr style={{ background: '#f5f5f5' }}>
            <th style={{ ...cell({ borderTop: 'none' }), width: '55%', textAlign: 'center', fontVariant: 'small-caps', fontWeight: 'bold', fontSize: 10 }}>
              Nature of Collection
            </th>
            <th style={{ ...cell({ borderTop: 'none', borderLeft: '1px solid #000' }), width: '20%', textAlign: 'center', fontVariant: 'small-caps', fontWeight: 'bold', fontSize: 10 }}>
              Account<br />Code
            </th>
            <th style={{ ...cell({ borderTop: 'none', borderLeft: '1px solid #000' }), width: '25%', textAlign: 'center', fontVariant: 'small-caps', fontWeight: 'bold', fontSize: 10 }}>
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {/* Primary row — document + purpose */}
          <tr>
            <td style={{ ...cell({ borderTop: '1px solid #000', minHeight: 20 }), fontSize: 11 }}>
              {req.documentType || '—'}
              {req.purpose ? ` – ${req.purpose}` : ''}
            </td>
            <td style={{ ...cell({ borderTop: '1px solid #000', borderLeft: '1px solid #000' }), textAlign: 'center' }}></td>
            <td style={{ ...cell({ borderTop: '1px solid #000', borderLeft: '1px solid #000' }), textAlign: 'right', fontWeight: 'bold' }}>
              {amount > 0 ? `₱ ${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : ''}
            </td>
          </tr>
          {/* Delivery method row */}
          <tr>
            <td style={{ ...cell({ borderTop: '1px solid #000' }), fontSize: 10, color: '#444' }}>
              {req.deliveryMethod ? `Delivery: ${req.deliveryMethod}` : ''}
            </td>
            <td style={{ ...cell({ borderTop: '1px solid #000', borderLeft: '1px solid #000' }) }}></td>
            <td style={{ ...cell({ borderTop: '1px solid #000', borderLeft: '1px solid #000' }) }}></td>
          </tr>
          {/* Blank filler rows */}
          {[...Array(6)].map((_, i) => (
            <tr key={i}>
              <td style={{ ...cell({ borderTop: '1px solid #000' }), height: 20 }}>&nbsp;</td>
              <td style={{ ...cell({ borderTop: '1px solid #000', borderLeft: '1px solid #000' }) }}></td>
              <td style={{ ...cell({ borderTop: '1px solid #000', borderLeft: '1px solid #000' }) }}></td>
            </tr>
          ))}
          {/* Total */}
          <tr>
            <td colSpan={2} style={{ ...cell({ borderTop: '2px solid #000' }), textAlign: 'center', fontWeight: 'bold', fontSize: 12, letterSpacing: 2 }}>
              TOTAL
            </td>
            <td style={{ ...cell({ borderTop: '2px solid #000', borderLeft: '1px solid #000' }), textAlign: 'right', fontWeight: 'bold' }}>
              {amount > 0 ? `₱ ${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : ''}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Amount in words ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginTop: -1 }}>
        <tbody>
          <tr>
            <td style={{ ...cell({ borderTop: 'none', paddingTop: 5, paddingBottom: 5 }) }}>
              <span style={{ fontVariant: 'small-caps', fontSize: 10, color: '#555' }}>Amount in Words</span>
              <br />
              <span style={{ fontStyle: 'italic', fontSize: 11 }}>{amountToWords(amount)}</span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Payment method + drawee bank ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginTop: -1 }}>
        <thead>
          <tr>
            <th style={{ ...cell({ borderTop: 'none' }), width: '28%' }}></th>
            <th style={{ ...cell({ borderTop: 'none', borderLeft: '1px solid #000' }), textAlign: 'center', fontVariant: 'small-caps', fontSize: 10, fontWeight: 'bold', width: '28%' }}>
              Drawee Bank
            </th>
            <th style={{ ...cell({ borderTop: 'none', borderLeft: '1px solid #000' }), textAlign: 'center', fontVariant: 'small-caps', fontSize: 10, fontWeight: 'bold', width: '22%' }}>
              Number
            </th>
            <th style={{ ...cell({ borderTop: 'none', borderLeft: '1px solid #000' }), textAlign: 'center', fontVariant: 'small-caps', fontSize: 10, fontWeight: 'bold', width: '22%' }}>
              Date
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ ...cell({ borderTop: '1px solid #000', verticalAlign: 'top', lineHeight: 1.9, fontSize: 10 }) }}>
              <div>☑ Online Payment</div>
              <div>☐ Cash</div>
            </td>
            <td style={{ ...cell({ borderTop: '1px solid #000', borderLeft: '1px solid #000', verticalAlign: 'top' }) }}></td>
            <td style={{ ...cell({ borderTop: '1px solid #000', borderLeft: '1px solid #000', verticalAlign: 'top' }) }}>
              {req.paymentLinkId ? String(req.paymentLinkId).slice(-8).toUpperCase() : ''}
            </td>
            <td style={{ ...cell({ borderTop: '1px solid #000', borderLeft: '1px solid #000', verticalAlign: 'top', fontSize: 10 }) }}>
              {dateStr}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Received note ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginTop: -1 }}>
        <tbody>
          <tr>
            <td style={{ ...cell({ borderTop: 'none', fontSize: 10, paddingTop: 5, paddingBottom: 24 }) }}>
              Received the amount stated above
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Signature ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginTop: -1 }}>
        <tbody>
          <tr>
            <td style={{ ...cell({ borderTop: 'none', textAlign: 'right', paddingBottom: 4 }) }}>
              <div style={{ width: 180, marginLeft: 'auto', textAlign: 'center' }}>
                {/* PNPKI digital signature block */}
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
                  {/* handwritten signature */}
                  <img
                    src="https://res.cloudinary.com/dvw7ky1xq/image/upload/v1778088798/Signature_k7he8f.png"
                    alt="signature"
                    style={{ width: 72, height: 52, objectFit: 'contain', flexShrink: 0 }}
                  />
                  {/* cert text */}
                  <div style={{ textAlign: 'left', fontSize: 7.5, lineHeight: 1.6, color: '#111' }}>
                    <div style={{ fontWeight: 'bold', fontSize: 7.5 }}>Digitally signed by</div>
                    <div style={{ fontWeight: 'bold' }}>{officerName}</div>
                    <div>Date: {(() => {
                      const d = new Date();
                      return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')} +08'00'`;
                    })()}</div>
                  </div>
                </div>
                <div style={{ borderTop: '1px solid #000', paddingTop: 3, fontSize: 10 }}>
                  Collecting Officer
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

    </div>
  );
}

export default function PrintReceiptModal({ req, residentName, onClose }) {
  const printRef = useRef(null);
  const officerName = useAuthStore((s) => s.user?.fullName || 'Collecting Officer');

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open('', '_blank', 'width=816,height=1056');
    win.document.write(`
      <html>
        <head>
          <title>Official Receipt – ${residentName}</title>
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; padding: 6mm; font-family: 'Times New Roman', Times, serif; }
            .wrapper {
              display: flex;
              flex-direction: row;
              gap: 0;
              width: 100%;
              height: 100%;
            }
            .receipt-half {
              width: 50%;
              padding: 4mm;
              box-sizing: border-box;
              overflow: hidden;
            }
            .divider {
              width: 1px;
              background: repeating-linear-gradient(to bottom, #aaa 0, #aaa 4px, transparent 4px, transparent 8px);
              flex-shrink: 0;
              margin: 0 2mm;
            }
            @media print {
              @page { size: 8.5in 11in portrait; margin: 6mm; }
            }
          </style>
        </head>
        <body>
          <div class="wrapper">
            <div class="receipt-half">${content}</div>
            <div class="divider"></div>
            <div class="receipt-half"></div>
          </div>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col"
        style={{ background: '#F5F5F5', borderRadius: 20, boxShadow: '0 16px 40px rgba(0,0,0,0.25)', maxHeight: '90vh', overflow: 'hidden', width: 520 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 shrink-0" style={{ background: '#fff', borderBottom: '1px solid #F0EAEA' }}>
          <p style={{ fontFamily: "'Kaisei Decol', serif", color: '#156D07', fontSize: 15 }}>Official Receipt – AF No. 51</p>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 transition-colors">
            <FiX size={18} color="#A18D8D" />
          </button>
        </div>

        {/* Preview */}
        <div className="overflow-auto flex-1 p-4 flex justify-center">
          <div ref={printRef} style={{ background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.12)', borderRadius: 4 }}>
            <ReceiptDocument req={req} residentName={residentName} officerName={officerName} />
          </div>
        </div>

        {/* Print button */}
        <div className="px-5 py-3 shrink-0" style={{ background: '#fff', borderTop: '1px solid #F0EAEA' }}>
          <button
            onClick={handlePrint}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white font-semibold text-sm"
            style={{ background: '#156D07', fontFamily: "'Hahmlet', sans-serif" }}
          >
            <FiPrinter size={16} />
            Print Receipt
          </button>
        </div>
      </div>
    </>
  );
}
