import type { SheetCell } from './types'
import { parseAmountCell, roundMoney } from './text'

/**
 * ICBC envía el "Resumen mensual" de la caja de ahorro / cuenta corriente sólo en PDF.
 * Del texto del PDF se arman las mismas celdas que daría una planilla.
 *
 * Particularidades del formato:
 * - La fecha viene como dd-mm, sin año: el año sale de "PERIODO dd-mm-aaaa AL dd-mm-aaaa".
 * - Débitos con el signo menos AL FINAL ("15.000,00-"); créditos sin signo.
 * - El saldo se imprime sólo en el último movimiento de cada día, no en todos.
 * - Arranca con "SALDO ULTIMO EXTRACTO AL dd/mm/aaaa" y termina con "SALDO FINAL AL dd/mm/aaaa".
 */

export const ICBC_HEADER: SheetCell[] = ['Fecha', 'Concepto', 'Comprobante ICBC', 'Importe', 'Saldo']

// dd-mm  CONCEPTO  [comprobante]  origen(4)  [canal]  importe  [saldo]
const MOVEMENT =
  /^(\d{2})-(\d{2})\s+(.+?)\s+(?:(\d{8,})\s+)?(\d{4})(?:\s+([A-Z]{2,5}))?\s+([\d.]+,\d{2}-?)(?:\s+([\d.]+,\d{2}-?))?\s*$/

function signedAmount(token: string): number {
  const negative = token.endsWith('-')
  const value = parseAmountCell(negative ? token.slice(0, -1) : token) ?? 0
  return negative ? -value : value
}

export type IcbcStatement = {
  cells: SheetCell[][]
  holder: string | null
  cuit: string | null
  accountNumber: string | null
  openingBalance: number | null
  closingBalance: number | null
  /** Diferencias entre el saldo calculado y el que imprime el banco. */
  warnings: string[]
}

export function isIcbcText(text: string): boolean {
  return /Industrial and Commercial Bank of China/i.test(text) && /SALDO ULTIMO EXTRACTO/i.test(text)
}

export function parseIcbcText(text: string): IcbcStatement {
  const period = text.match(/PERIODO\s+(\d{2})-(\d{2})-(\d{4})\s+AL\s+(\d{2})-(\d{2})-(\d{4})/i)
  const startMonth = period ? Number(period[2]) : 1
  const startYear = period ? Number(period[3]) : new Date().getFullYear()
  const opening = text.match(/SALDO ULTIMO EXTRACTO AL\s+\d{2}\/\d{2}\/\d{4}\s+(-?[\d.]+,\d{2}-?)/i)
  const closing = text.match(/SALDO FINAL AL\s+\d{2}\/\d{2}\/\d{4}\s+(-?[\d.]+,\d{2}-?)/i)
  const cuit = text.match(/CUIT N°\s*(\d{2})-(\d{8})-(\d)/i)
  const accountNumber = text.match(/N°\s*(\d{4}\/\d{8}\/\d{2})/)
  const holder = text.match(/V\.001\s*\n\s*(.+)\n/)

  const openingBalance = opening ? signedAmount(opening[1]) : null
  const closingBalance = closing ? signedAmount(closing[1]) : null

  const cells: SheetCell[][] = [ICBC_HEADER]
  const warnings: string[] = []
  let running = openingBalance

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    const m = line.match(MOVEMENT)
    if (!m) continue
    const [, dd, mm, concept, comprobante, , , amountToken, balanceToken] = m
    // Si el período cruza de año (dic → ene), los meses menores al de inicio son del año siguiente.
    const year = Number(mm) < startMonth ? startYear + 1 : startYear
    const amount = signedAmount(amountToken)
    const printed = balanceToken ? signedAmount(balanceToken) : null

    if (running !== null) running = roundMoney(running + amount)
    if (printed !== null && running !== null && Math.abs(printed - running) > 0.01) {
      warnings.push(
        `ICBC ${dd}/${mm}: el saldo impreso (${printed.toLocaleString('es-AR')}) no coincide con el calculado (${running.toLocaleString('es-AR')})`
      )
    }
    if (printed !== null) running = printed

    // Completamos el saldo en todas las filas (el banco lo imprime sólo al cierre de cada día).
    cells.push([`${dd}/${mm}/${year}`, concept.trim(), comprobante ?? null, amount, running])
  }

  if (closingBalance !== null && running !== null && Math.abs(closingBalance - running) > 0.01) {
    warnings.push('El saldo final del PDF de ICBC no coincide con los movimientos leídos: puede faltar un movimiento')
  }

  return {
    cells,
    holder: holder?.[1]?.trim() ?? null,
    cuit: cuit ? `${cuit[1]}${cuit[2]}${cuit[3]}` : null,
    accountNumber: accountNumber?.[1] ?? null,
    openingBalance,
    closingBalance,
    warnings,
  }
}
