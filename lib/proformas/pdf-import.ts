/**
 * Arma las líneas de una proforma a partir del PDF y evalúa si se puede
 * guardar. Lo usan "Nueva proforma" (una) e "Importar PDF" (todas las del PDF).
 */
import { roundCents } from '@/lib/pdf/numbers'
import type { ArcorProformaGroup } from '@/lib/proformas/parse-arcor-pdf'
import { reviewProformaPdf, type ProformaPdfReview, type TripMatch } from '@/lib/proformas/pdf-review'
import {
  buildLineItemsJson,
  formatTripLineAmount,
  signedTripLineAmount,
  type TripLineValues,
} from '@/lib/proformas/trip-estimate-amount'

export type PdfProformaLines = {
  tripIds: string[]
  lines: Record<string, TripLineValues>
  sharedTripIds: Set<string>
}

/** Una línea por viaje con el importe del PDF; ajuste si ya estaba facturado para la misma compañía. */
export function buildLinesFromPdf(
  group: ArcorProformaGroup,
  matches: Record<string, TripMatch | null>
): PdfProformaLines {
  const byTrip = new Map<string, { amount: number; match: TripMatch }>()
  for (const row of group.rows) {
    const match = matches[row.code]
    if (!match || match.kind === 'not_billable') continue
    const prev = byTrip.get(match.tripId)
    byTrip.set(match.tripId, { amount: roundCents((prev?.amount ?? 0) + row.amount), match })
  }

  const lines: Record<string, TripLineValues> = {}
  const sharedTripIds = new Set<string>()
  for (const [tripId, { amount, match }] of byTrip) {
    if (match.kind === 'adjustment') {
      lines[tripId] = {
        amount: formatTripLineAmount(Math.abs(amount)),
        taxes: '0',
        adjustment: {
          direction: amount < 0 ? 'down' : 'up',
          reason:
            match.otherProformas.length > 0
              ? `Según PDF (ya estaba en ${match.otherProformas.join(', ')})`
              : 'Según PDF (facturado en el sistema anterior)',
        },
      }
    } else {
      lines[tripId] = { amount: formatTripLineAmount(amount), taxes: '0' }
      if (match.kind === 'shared') sharedTripIds.add(tripId)
    }
  }
  return { tripIds: Array.from(byTrip.keys()), lines, sharedTripIds }
}

export function lineAmountsByTrip(tripIds: string[], lines: Record<string, TripLineValues>) {
  return new Map(tripIds.map((id) => [id, roundCents(signedTripLineAmount(lines[id]))] as const))
}

export type PdfGroupStatus = 'ready' | 'problems' | 'existing'

export type PdfGroupAssessment = {
  status: PdfGroupStatus
  review: ProformaPdfReview
  /** Bloquean el guardado. */
  problems: string[]
  /** Para mirar, no bloquean: el PDF manda. */
  priceWarnings: { code: string; pdf: number; expected: number; diff: number }[]
  lineItemsJson: string
}

/** Estado de una proforma del PDF dentro de "Importar PDF". */
export function assessPdfGroup(
  group: ArcorProformaGroup,
  match: { clientId: string | null; existingProformaNumber: string | null; matches: Record<string, TripMatch | null> }
): PdfGroupAssessment {
  const built = buildLinesFromPdf(group, match.matches)
  const review = reviewProformaPdf(group, match.matches, lineAmountsByTrip(built.tripIds, built.lines))

  const problems = [...review.problems]
  if (!match.clientId) {
    problems.unshift(`No hay un cliente con el CUIT ${group.cuit ?? '(sin CUIT)'} en Clientes`)
  }

  const priceWarnings = review.rows
    .filter((r) => r.match?.estimate != null && roundCents(r.row.amount - r.match.estimate) !== 0)
    .map((r) => ({
      code: r.row.code,
      pdf: r.row.amount,
      expected: r.match!.estimate as number,
      diff: roundCents(r.row.amount - (r.match!.estimate as number)),
    }))

  const status: PdfGroupStatus = match.existingProformaNumber
    ? 'existing'
    : problems.length > 0
      ? 'problems'
      : 'ready'

  return {
    status,
    review,
    problems,
    priceWarnings,
    lineItemsJson: buildLineItemsJson(built.tripIds, built.lines),
  }
}
