import type { Metadata } from 'next';
import WebcamGallery from '@/components/WebcamGallery';
import EmbedResizer from '@/components/EmbedResizer';
import { webcamPageData } from '@/lib/webcams/page-data';
import { SITE_NAME, SITE_URL } from '@/lib/config';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Version intégrable : /embed/webcams/?ville=brest */
export default async function EmbedWebcams({ searchParams }: { searchParams: Promise<{ ville?: string }> }) {
  const { ville } = await searchParams;
  return (
    <div className="p-3">
      <h1 className="mb-3 text-xl font-extrabold">Webcams météo en direct</h1>
      <WebcamGallery {...webcamPageData()} initialCity={ville} />
      <p className="mt-3 text-xs text-muted">
        Propulsé par <a className="underline" href={`${SITE_URL}/webcams/`} target="_blank" rel="noopener">{SITE_NAME}</a>
      </p>
      <EmbedResizer />
    </div>
  );
}
