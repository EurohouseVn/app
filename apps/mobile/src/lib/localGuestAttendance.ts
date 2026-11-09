export const GUEST_ATTENDANCE_KEY = '@eurohouse_guest_attendance_v1';

export type GuestAttendanceRecord = {
  date: string;
  checkIn?: string;
  checkOut?: string;
};

type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

function key(installationId: string) {
  return `${GUEST_ATTENDANCE_KEY}:guest_${installationId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

export async function listGuestAttendance(storage: Storage, installationId: string): Promise<GuestAttendanceRecord[]> {
  try {
    const parsed = JSON.parse((await storage.getItem(key(installationId))) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function recordGuestAttendance(
  storage: Storage,
  installationId: string,
  date: string,
  action: 'CHECK_IN' | 'CHECK_OUT',
  now = new Date(),
): Promise<GuestAttendanceRecord> {
  const records = await listGuestAttendance(storage, installationId);
  const existing = records.find((record) => record.date === date) ?? { date };
  if (action === 'CHECK_IN' && !existing.checkIn) existing.checkIn = now.toISOString();
  if (action === 'CHECK_OUT' && !existing.checkOut) existing.checkOut = now.toISOString();
  const next = [existing, ...records.filter((record) => record.date !== date)].sort((a, b) => b.date.localeCompare(a.date));
  await storage.setItem(key(installationId), JSON.stringify(next));
  return existing;
}
