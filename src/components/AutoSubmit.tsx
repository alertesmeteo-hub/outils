'use client';

import { useEffect, useRef } from 'react';

/** Soumet le formulaire parent dès qu'un filtre change (sans bouton « Afficher »). */
export default function AutoSubmit() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const form = ref.current?.closest('form');
    if (!form) return;
    const onChange = () => form.requestSubmit();
    form.addEventListener('change', onChange);
    return () => form.removeEventListener('change', onChange);
  }, []);
  return <span ref={ref} hidden />;
}
