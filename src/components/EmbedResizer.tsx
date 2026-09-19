'use client';

import { useEffect } from 'react';

/** Informe la page hôte (WordPress…) de la hauteur du contenu pour ajuster l'iframe. */
export default function EmbedResizer() {
  useEffect(() => {
    const send = () => window.parent?.postMessage({ type: 'meteo-outils:height', height: document.documentElement.scrollHeight }, '*');
    const ro = new ResizeObserver(send);
    ro.observe(document.body);
    send();
    return () => ro.disconnect();
  }, []);
  return null;
}
