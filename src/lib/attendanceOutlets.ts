export function canManageAttendanceOutlets(role: string | null | undefined) {
  return role === 'admin';
}

export function allowedAttendanceOutlets<T extends { id: string; name: string }>(
  outlets: T[], role: string | null | undefined, primaryId: string | null, additionalIds: string[],
): T[] {
  const unrestricted = role === 'admin' || role === 'management';
  return outlets.filter((o) => o.name !== 'Manajemen' &&
    (unrestricted || o.id === primaryId || additionalIds.includes(o.id)));
}