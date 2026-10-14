export default function TrialEnabledSwitch({ checked, onChange, disabled = false, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} title={label} onClick={onChange} disabled={disabled}
      className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-[8px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2C56A8] disabled:cursor-not-allowed disabled:opacity-50">
      <span aria-hidden="true" className={`relative inline-flex h-6 w-11 rounded-full border-2 border-transparent transition-colors motion-reduce:transition-none ${checked ? "bg-emerald-500" : "bg-[#8993AC]"}`}>
        <span className={`h-5 w-5 rounded-full bg-white transition-transform motion-reduce:transition-none ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </span>
    </button>
  );
}
