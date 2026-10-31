import type { TreasuryTransaction } from './types'

const FEE = /COMISION|COMIS\.|MANTENIMIENTO MENSUAL|COM\. SERV/
const TAX_ON_FEE = /DEBITO FISCAL IVA|I\.V\.A\.|\bIVA\b|RETEN\. I\.V\.A/

export type MovementEntry =
  | { type: 'single'; tx: TreasuryTransaction }
  | { type: 'group'; key: string; main: TreasuryTransaction; members: TreasuryTransaction[]; total: number }

/**
 * Agrupa una comisión bancaria con su IVA en un solo renglón.
 * Macro las informa con el mismo número de transacción; Nación sin número, el mismo día.
 * Sólo agrupa si hay una comisión y al menos una línea de IVA. Es sólo visual.
 */
export function groupFeeLines(txs: TreasuryTransaction[]): MovementEntry[] {
  const keyOf = (t: TreasuryTransaction) => `${t.accountId}|${t.txDate}|${t.reference ?? ''}`
  const candidates = new Map<string, TreasuryTransaction[]>()
  for (const t of txs) {
    if (t.amount >= 0) continue
    if (!FEE.test(t.descriptionNorm) && !TAX_ON_FEE.test(t.descriptionNorm)) continue
    const k = keyOf(t)
    candidates.set(k, [...(candidates.get(k) ?? []), t])
  }
  const groups = new Map<string, TreasuryTransaction[]>()
  for (const [k, members] of candidates) {
    const fee = members.filter((m) => FEE.test(m.descriptionNorm))
    const tax = members.filter((m) => TAX_ON_FEE.test(m.descriptionNorm) && !FEE.test(m.descriptionNorm))
    // Sin número de referencia exigimos exactamente una comisión, para no mezclar comisiones distintas.
    if (fee.length >= 1 && tax.length >= 1 && (members[0].reference || fee.length === 1)) groups.set(k, members)
  }

  const out: MovementEntry[] = []
  const emitted = new Set<string>()
  for (const t of txs) {
    const k = keyOf(t)
    const members = groups.get(k)
    if (!members || !members.some((m) => m.id === t.id)) {
      out.push({ type: 'single', tx: t })
      continue
    }
    if (emitted.has(k)) continue
    emitted.add(k)
    const main = members.find((m) => FEE.test(m.descriptionNorm)) ?? members[0]
    out.push({
      type: 'group',
      key: k,
      main,
      members,
      total: Math.round(members.reduce((a, m) => a + m.amount, 0) * 100) / 100,
    })
  }
  return out
}
