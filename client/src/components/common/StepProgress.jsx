export default function StepProgress({ current, total = 3 }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {Array.from({ length: total }, (_, i) => i + 1).map((step) => (
        <div key={step} className="flex items-center flex-1 last:flex-none">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-colors
              ${step < current
                ? 'bg-primary text-white'
                : step === current
                  ? 'bg-primary text-white ring-4 ring-accent/25'
                  : 'bg-gray-200 text-gray-500'}`}
          >
            {step < current ? '✓' : step}
          </div>
          {step < total && (
            <div className={`h-1 flex-1 mx-1 rounded transition-colors ${step < current ? 'bg-primary' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}
