'use client';

export default function ThemeToggle() {
  const toggle = () => {
    const dark = document.documentElement.classList.toggle('dark');
    try { localStorage.setItem('mo:theme', dark ? 'dark' : 'light'); } catch {}
  };
  return (
    <button type="button" onClick={toggle} className="btn btn-ghost !min-h-[40px] !px-3" aria-label="Basculer entre mode clair et mode sombre" title="Mode clair / sombre">
      <span aria-hidden>🌓</span>
    </button>
  );
}
