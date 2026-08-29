/**
 * Formats an ISO date string (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss) to Brazilian format DD/MM/YYYY.
 * Prevents UTC timezone rollback issues caused by standard new Date("YYYY-MM-DD").
 */
export function formatDate(dateStr?: string | null | any): string {
  if (!dateStr) return '—';

  if (typeof dateStr !== 'string') {
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
    } catch {
      return '—';
    }
  }

  const rawDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.trim();
  const parts = rawDate.split('-');

  if (parts.length === 3) {
    const [year, month, day] = parts;
    if (year && month && day) {
      return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    }
  }

  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
  } catch {
    return '—';
  }
}

/**
 * Formats a date/timestamp with date and time in Brazilian locale (DD/MM/YYYY HH:mm:ss).
 */
export function formatDateTime(dateStr?: string | null | any): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR');
  } catch {
    return '—';
  }
}
