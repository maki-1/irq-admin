export default function DiditVerificationSummary({ result }) {
  if (result?.provider !== 'didit') return null;
  const checks = [
    ['ID document', result.idStatus],
    ['Live selfie', result.livenessStatus],
    ['Face match', result.faceMatchStatus],
  ];
  return (
    <section className="rounded-xl border border-green-200 bg-green-50 p-4">
      <h3 className="text-sm font-semibold text-green-900">Identity verification checks</h3>
      <dl className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        {checks.map(([label, status]) => (
          <div key={label}><dt className="text-gray-600">{label}</dt><dd className="font-semibold text-green-900">{status || 'Not available'}</dd></div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-gray-600">Review the name on the ID, resident details, and submitted documents before approving this application.</p>
    </section>
  );
}
