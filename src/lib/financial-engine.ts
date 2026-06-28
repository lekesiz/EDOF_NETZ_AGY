import { addDays, isBefore, format, parseISO, startOfDay } from 'date-fns';
import type { Dossier, DashboardStats, MonthlyData } from '@/types';

/**
 * Mots-clés d'annulation/refus - compatibles avec les statuts WEDOF.
 */
const CANCEL_KEYWORDS = ['cancel', 'refus', 'reject', 'annul', 'abandon'];

/**
 * Décalage par défaut pour le calcul de l'échéance : date de fin + 37 jours.
 */
const DEFAULT_DUE_DATE_OFFSET_DAYS = 37;

/**
 * Vérifie si le statut d'un dossier indique une annulation ou un refus.
 */
export function isInvalidated(status: string | null): boolean {
  if (!status) return false;
  const lower = status.toLowerCase();
  return CANCEL_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Calcule la date d'échéance = date_fin + nombre de jours d'échéance.
 */
export function getDueDate(endDate: string | null, vadeGun: number = DEFAULT_DUE_DATE_OFFSET_DAYS): Date | null {
  if (!endDate) return null;
  try {
    return addDays(parseISO(endDate), vadeGun);
  } catch {
    return null;
  }
}

/**
 * Catégorise un dossier selon sa situation financière :
 * - kasa (Encaissé/Échu) : Échéance <= aujourd'hui ET non annulé
 * - alacak (En attente/À venir) : Échéance > aujourd'hui ET non annulé
 * - kayip (Annulé/Refusé) : Statut annulé, refusé ou rejeté
 */
export function categorizeDossier(dossier: Dossier, vadeGun: number = DEFAULT_DUE_DATE_OFFSET_DAYS): 'kasa' | 'alacak' | 'kayip' {
  if (isInvalidated(dossier.wedof_status)) return 'kayip';

  const today = startOfDay(new Date());
  const dueDate = getDueDate(dossier.end_date, vadeGun);

  if (!dueDate) return 'alacak';

  if (isBefore(dueDate, today) || dueDate.getTime() === today.getTime()) {
    return 'kasa';
  }

  return 'alacak';
}

/**
 * Calcule toutes les statistiques du tableau de bord à partir de la liste des dossiers.
 */
export function computeDashboardStats(dossiers: Dossier[], year: number, vadeGun: number = DEFAULT_DUE_DATE_OFFSET_DAYS): DashboardStats & { targetAmount: number } {
  let kasa = 0;
  let alacak = 0;
  let kayip = 0;
  let reconciledCount = 0;

  for (const d of dossiers) {
    const amount = Number(d.amount) || 0;
    const category = categorizeDossier(d, vadeGun);

    switch (category) {
      case 'kasa':
        kasa += amount;
        break;
      case 'alacak':
        alacak += amount;
        break;
      case 'kayip':
        kayip += amount;
        break;
    }

    if (d.is_reconciled) reconciledCount++;
  }

  const totalTarget = kasa + alacak;

  return {
    totalTarget,
    targetAmount: totalTarget,
    kasa,
    overdue: 0,
    invoicedPending: alacak,
    uninvoiced: 0,
    kayip,
    previousYearTotal: 0,
    totalDossiers: dossiers.length,
    reconciledCount,
  };
}

/**
 * Calcule la répartition mensuelle pour les graphiques.
 */
export function computeMonthlyData(dossiers: Dossier[], year: number, vadeGun: number = DEFAULT_DUE_DATE_OFFSET_DAYS): MonthlyData[] {
  const months: MonthlyData[] = [];
  for (let m = 0; m < 12; m++) {
    months.push({
      month: format(new Date(year, m, 1), 'yyyy-MM'),
      kasa: 0,
      alacak: 0,
      kayip: 0,
    });
  }

  const today = startOfDay(new Date());

  for (const d of dossiers) {
    const amount = Number(d.amount) || 0;
    const dueDate = getDueDate(d.end_date, vadeGun);
    if (!dueDate) continue;

    const dueYear = dueDate.getFullYear();
    if (dueYear !== year) continue;

    const monthIdx = dueDate.getMonth();

    if (isInvalidated(d.wedof_status)) {
      months[monthIdx].kayip += amount;
    } else if (isBefore(dueDate, today) || dueDate.getTime() === today.getTime()) {
      months[monthIdx].kasa += amount;
    } else {
      months[monthIdx].alacak += amount;
    }
  }

  return months;
}
