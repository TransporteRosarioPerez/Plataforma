/** Payload para dar de baja un registro (soft delete). */
export function softDeleteUpdate() {
  return { deleted_at: new Date().toISOString() }
}

export const restoreUpdate = { deleted_at: null } as const
