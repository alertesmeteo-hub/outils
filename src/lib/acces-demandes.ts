import 'server-only';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Demandes d'accès : un fichier JSON par ligne, dans data/ du dossier de l'application (hors du dossier .next remplacé à chaque mise en ligne). */
const FICHIER = join(process.cwd(), 'data', 'acces-demandes.jsonl');

export interface DemandeAcces {
  date: string;
  nom: string;
  email: string;
  message: string;
}

export async function enregistrerDemande(d: DemandeAcces): Promise<void> {
  await mkdir(join(process.cwd(), 'data'), { recursive: true });
  await appendFile(FICHIER, `${JSON.stringify(d)}\n`, 'utf8');
}

export async function lireDemandes(): Promise<DemandeAcces[]> {
  try {
    const texte = await readFile(FICHIER, 'utf8');
    return texte
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as DemandeAcces)
      .reverse();
  } catch {
    return [];
  }
}
