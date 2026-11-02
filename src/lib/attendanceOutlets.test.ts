import { describe, expect, it } from 'vitest';
import { allowedAttendanceOutlets, canManageAttendanceOutlets } from './attendanceOutlets';

const outlets = [{ id: 'utama', name: 'Utama' }, { id: 'double', name: 'K3Jora' }, { id: 'lain', name: 'Lain' }, { id: 'office', name: 'Manajemen' }];
describe('cabang double job', () => {
  it('only admin can configure additional outlets', () => {
    expect(canManageAttendanceOutlets('admin')).toBe(true);
    for (const role of ['management', 'pic', 'crew', 'staff', null]) expect(canManageAttendanceOutlets(role)).toBe(false);
  });
  it('crew can attend their primary and assigned double-job outlet only', () => {
    expect(allowedAttendanceOutlets(outlets, 'crew', 'utama', ['double']).map(o => o.id)).toEqual(['utama', 'double']);
  });
  it('revoking a double-job assignment removes that outlet', () => {
    expect(allowedAttendanceOutlets(outlets, 'crew', 'utama', []).map(o => o.id)).toEqual(['utama']);
  });
  it('keeps management outlet out of selfie choices', () => {
    expect(allowedAttendanceOutlets(outlets, 'admin', null, []).map(o => o.id)).toEqual(['utama', 'double', 'lain']);
  });
});