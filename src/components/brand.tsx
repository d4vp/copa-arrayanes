/** Logotipo oficial: escudo con "A" y hoja de arrayán. Vectorial, dos tonos. */
export function LogoMark({ className = "size-9", title = "Copa Arrayanes" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 64 72" className={className} role="img" aria-label={title}>
      <path d="M32 2 58 9.5V33c0 17.5-11 30-26 37C17 63 6 50.5 6 33V9.5Z" fill="#1d4ed8" />
      <path d="M32 6.3 54 12.6V33c0 15.2-9.2 26.3-22 32.6C19.2 59.3 10 48.2 10 33V12.6Z" fill="none" stroke="#fff" strokeOpacity=".9" strokeWidth="1.6" />
      <path d="M19.5 55 32 19l12.5 36" fill="none" stroke="#fff" strokeWidth="7" strokeLinejoin="round" />
      <path d="M17 45.5c7-9 19-12.5 31-9.5-7 8.5-19.5 12-31 9.5Z" fill="#22c55e" stroke="#1d4ed8" strokeWidth="1.6" />
      <path d="M20.5 44.3c8.5-3.3 16.5-5.3 24.5-6.6" stroke="#14532d" strokeWidth="1.1" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark className={compact ? "size-8" : "size-10"} />
      <span className="font-display leading-none">
        <span className="block text-[0.7rem] font-semibold tracking-[0.2em] text-[var(--accent)]">COPA</span>
        <span className="block text-lg font-extrabold tracking-wide text-[var(--brand-strong)] dark:text-white">ARRAYANES</span>
      </span>
    </span>
  );
}
