/** Three ruled lines and a dot: a to-do list reduced to its bones. */
export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="7" fill="var(--ink)" />
      <path d="M8 11h16M8 16h10M8 21h6" stroke="var(--bg)" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="23" cy="21" r="3" fill="var(--accent)" />
    </svg>
  );
}
