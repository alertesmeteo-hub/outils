export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || 'Météo Outils';
export const CTA_URL = process.env.NEXT_PUBLIC_WEATHER_REPORT_URL || '/attestation-meteo/';
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'contact@example.fr';
