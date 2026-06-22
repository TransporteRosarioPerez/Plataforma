export type TripEconomicsOutcome =
  | 'pending'
  | 'pending_income'
  | 'break_even'
  | 'profit'
  | 'loss'

export type TripEconomics = {
  income: number
  expenses: number
  profit: number
  marginPercent: number | null
  outcome: TripEconomicsOutcome
}

export const tripEconomicsOutcomeLabels: Record<TripEconomicsOutcome, string> = {
  pending: 'Sin datos',
  pending_income: 'Sin ingreso',
  break_even: 'Equilibrio',
  profit: 'Ganancia',
  loss: 'Pérdida',
}

export const tripEconomicsOutcomeDescriptions: Record<TripEconomicsOutcome, string> = {
  pending: 'Cargá el importe a cobrar y los gastos del viaje para ver el resultado.',
  pending_income: 'Hay gastos cargados pero falta definir cuánto se cobra por este viaje.',
  break_even: 'Los ingresos cubren exactamente los gastos.',
  profit: 'El viaje deja dinero después de descontar gastos.',
  loss: 'Los gastos superan lo que se cobra por este viaje.',
}

export function getTripEconomics(income: number, expenses: number): TripEconomics {
  const safeIncome = Number.isFinite(income) ? income : 0
  const safeExpenses = Number.isFinite(expenses) ? expenses : 0
  const profit = safeIncome - safeExpenses
  const marginPercent = safeIncome > 0 ? (profit / safeIncome) * 100 : null

  let outcome: TripEconomicsOutcome
  if (safeIncome === 0 && safeExpenses === 0) {
    outcome = 'pending'
  } else if (safeIncome === 0) {
    outcome = 'pending_income'
  } else if (profit > 0) {
    outcome = 'profit'
  } else if (profit < 0) {
    outcome = 'loss'
  } else {
    outcome = 'break_even'
  }

  return {
    income: safeIncome,
    expenses: safeExpenses,
    profit,
    marginPercent,
    outcome,
  }
}

export function formatTripCurrency(value: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatTripMargin(marginPercent: number | null) {
  if (marginPercent === null) return null
  const rounded = Math.round(marginPercent * 10) / 10
  const sign = rounded > 0 ? '+' : ''
  return `${sign}${rounded}%`
}
