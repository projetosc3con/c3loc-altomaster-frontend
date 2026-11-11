export interface RentalPeriodLike {
  id?: string | null;
  tempId?: string | null;
  equipment_id?: string | null;
  asset_number?: string | null;
  equipment_name?: string | null;
  billing_period_start?: string | null;
  billing_period_end?: string | null;
  return_date?: string | null;
}

export interface MachineResolutionResult<T extends RentalPeriodLike> {
  /** Último registro de cada máquina distinta (por equipment_id / patrimônio). */
  allLatestMachines: T[];
  /** Máquinas cujo último período não foi substituído por outra máquina em período posterior. */
  nonSupersededMachines: T[];
  /** Máquinas atualmente ativas (não devolvidas e não substituídas) aptas para prorrogação. */
  activeMachines: T[];
  /** Máquinas antigas sem return_date que foram substituídas em um período posterior. */
  supersededMachines: T[];
}

const normalizeDateStr = (d?: string | null): string =>
  d ? String(d).split('T')[0].trim() : '';

const getMachineKey = <T extends RentalPeriodLike>(eq: T, fallbackIndex: number): string =>
  eq.equipment_id || eq.asset_number || eq.equipment_name || eq.id || eq.tempId || `idx-${fallbackIndex}`;

/**
 * Resolve quais máquinas de uma locação estão realmente ativas no ciclo atual,
 * evitando que trocas de equipamento entre períodos anteriores e a última renovação
 * sejam interpretadas como múltiplas máquinas simultâneas ativas.
 */
export function resolveLatestMachinesWithSwapStatus<T extends RentalPeriodLike>(
  equipments: T[]
): MachineResolutionResult<T> {
  if (!equipments || equipments.length === 0) {
    return {
      allLatestMachines: [],
      nonSupersededMachines: [],
      activeMachines: [],
      supersededMachines: [],
    };
  }

  // 1. Encontrar o último período de cada máquina distinta
  const machineMap = new Map<string, { item: T; key: string }>();
  equipments.forEach((eq, idx) => {
    const key = getMachineKey(eq, idx);
    const existing = machineMap.get(key);
    if (!existing) {
      machineMap.set(key, { item: eq, key });
      return;
    }

    const exEnd = normalizeDateStr(existing.item.billing_period_end);
    const curEnd = normalizeDateStr(eq.billing_period_end);
    const exStart = normalizeDateStr(existing.item.billing_period_start);
    const curStart = normalizeDateStr(eq.billing_period_start);

    if (curEnd > exEnd || (curEnd === exEnd && curStart >= exStart)) {
      machineMap.set(key, { item: eq, key });
    }
  });

  const allLatestEntries = Array.from(machineMap.values());
  const normalizedRows = equipments.map((row, idx) => ({
    row,
    key: getMachineKey(row, idx),
    start: normalizeDateStr(row.billing_period_start),
    end: normalizeDateStr(row.billing_period_end),
    ret: normalizeDateStr(row.return_date),
  }));

  // 2. Identificar máquinas cujo último período [sM, eM] foi substituído em período posterior
  // (existe período iniciado estritamente após eM com alguma máquina que não coexistia em [sM, eM])
  const isSupersededEntry = (entry: { item: T; key: string }): boolean => {
    const sM = normalizeDateStr(entry.item.billing_period_start);
    const eM = normalizeDateStr(entry.item.billing_period_end);
    if (!eM) return false;

    const concurrentKeys = new Set<string>();
    for (const r of normalizedRows) {
      if (r.key === entry.key) continue;
      if (r.ret && sM && r.ret < sM) continue;
      const hasDates = Boolean(r.start || r.end);
      const overlaps =
        hasDates &&
        (!r.start || r.start <= eM) &&
        (!r.end || !sM || r.end >= sM);
      if (overlaps) {
        concurrentKeys.add(r.key);
      }
    }

    for (const r of normalizedRows) {
      if (r.key === entry.key) continue;
      if (r.start && r.start > eM && !concurrentKeys.has(r.key)) {
        return true;
      }
    }

    return false;
  };

  const nonSupersededMachines: T[] = [];
  const supersededMachines: T[] = [];

  for (const entry of allLatestEntries) {
    const hasReturnDate = Boolean(normalizeDateStr(entry.item.return_date));
    if (!hasReturnDate && isSupersededEntry(entry)) {
      supersededMachines.push(entry.item);
    } else {
      nonSupersededMachines.push(entry.item);
    }
  }

  const activeMachines = nonSupersededMachines.filter(
    (item) => !normalizeDateStr(item.return_date)
  );

  return {
    allLatestMachines: allLatestEntries.map((e) => e.item),
    nonSupersededMachines,
    activeMachines,
    supersededMachines,
  };
}
