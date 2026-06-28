/**
 * Extrait le nom du client depuis le label de la facture Pennylane.
 * Format typique : "Facture Prénom NOM - NETZ-F-2026-XXXX (label généré)"
 * Retourne le nom en minuscules pour la comparaison.
 */
export function extractNameFromLabel(label: string): { firstName: string; lastName: string } | null {
  if (!label) return null;

  // Pattern: "Facture {Name} - NETZ-F-..."
  const match = label.match(/^Facture\s+(.+?)\s*-\s*NETZ-F-/i);
  if (!match) return null;

  const fullName = match[1].trim();
  const parts = fullName.split(/\s+/);
  if (parts.length < 2) return null;

  // Le dernier mot est généralement le nom de famille (en majuscules)
  // Mais il peut y avoir des noms composés comme "DE JESUS"
  // Stratégie : trouver le premier mot en majuscules et considérer tout ce qui suit comme le nom
  let lastNameStart = parts.length - 1;
  for (let i = 1; i < parts.length; i++) {
    if (parts[i] === parts[i].toUpperCase() && parts[i].length > 1) {
      lastNameStart = i;
      break;
    }
  }

  const firstName = parts.slice(0, lastNameStart).join(' ').toLowerCase();
  const lastName = parts.slice(lastNameStart).join(' ').toLowerCase();

  return { firstName, lastName };
}

/**
 * Normalise un nom pour la comparaison (minuscules, sans accents, sans tirets).
 */
export function normalizeName(name: string | null): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprimer les accents
    .replace(/[-']/g, ' ')           // Remplacer tirets et apostrophes par des espaces
    .replace(/\s+/g, ' ')            // Normaliser les espaces
    .trim();
}

/**
 * Calcule un score de similarité entre deux noms (0 = pas de match, 1 = match exact).
 */
export function nameSimilarity(a: string, b: string): number {
  const normA = normalizeName(a);
  const normB = normalizeName(b);

  if (normA === normB) return 1;
  if (!normA || !normB) return 0;

  // Vérifier si l'un contient l'autre
  if (normA.includes(normB) || normB.includes(normA)) return 0.9;

  // Comparer les mots individuels
  const wordsA = normA.split(' ');
  const wordsB = new Set(normB.split(' '));
  const intersection = wordsA.filter(w => wordsB.has(w));

  if (intersection.length === 0) return 0;
  return intersection.length / Math.max(wordsA.length, wordsB.size);
}
