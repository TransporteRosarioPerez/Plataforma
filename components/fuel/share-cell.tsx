/** Porcentaje con una barra fina: se compara de un vistazo quién se lleva más del gasto. */
export function ShareCell({ value }: { value: number }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full rounded-full bg-chart-1" style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="w-12 text-right tabular-nums">{value.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%</span>
    </div>
  )
}
