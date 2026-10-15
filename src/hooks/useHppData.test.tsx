import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ from: vi.fn(), rows: new Map<string, { materials: unknown[]; products: unknown[]; fixed_cost: number; version: number }>(), writes: [] as string[] }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mock.from } }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
import { useHppData } from './useHppData';

beforeEach(() => {
  mock.rows.clear(); mock.writes.length = 0;
  mock.rows.set('depot', { materials: [], products: [], fixed_cost: 1000, version: 1 });
  mock.rows.set('kopitiam', { materials: [], products: [], fixed_cost: 2000, version: 1 });
  mock.from.mockImplementation(() => {
    const filters: Record<string, unknown> = {};
    let payload: Record<string, unknown> | undefined;
    const chain = {
      select: () => chain,
      update: (next: Record<string, unknown>) => { payload = next; return chain; },
      eq: (key: string, value: unknown) => { filters[key] = value; return chain; },
      single: async () => ({ data: mock.rows.get(String(filters.outlet_id)), error: null }),
      maybeSingle: async () => {
        const id = String(filters.outlet_id); const row = mock.rows.get(id);
        if (!row || row.version !== filters.version || !payload) return { data: null, error: null };
        row.fixed_cost = Number(payload.fixed_cost); row.version += 1; mock.writes.push(id);
        return { data: { version: row.version }, error: null };
      },
    };
    return chain;
  });
});

describe('outlet HPP rooms', () => {
  it('reads distinct HPP settings for each outlet', async () => {
    const depot = renderHook(() => useHppData('depot'));
    const kopitiam = renderHook(() => useHppData('kopitiam'));
    await waitFor(() => expect(depot.result.current.loading).toBe(false));
    await waitFor(() => expect(kopitiam.result.current.loading).toBe(false));
    expect(depot.result.current.data.fixedCost).toBe(1000);
    expect(kopitiam.result.current.data.fixedCost).toBe(2000);
  });
  it('saves only the selected outlet and reads it back in another session', async () => {
    const depot = renderHook(() => useHppData('depot'));
    await waitFor(() => expect(depot.result.current.loading).toBe(false));
    await act(async () => { expect(await depot.result.current.save({ materials: [], products: [], fixedCost: 3000 })).toBe(true); });
    expect(mock.writes).toEqual(['depot']);
    expect(mock.rows.get('kopitiam')?.fixed_cost).toBe(2000);
    const secondSession = renderHook(() => useHppData('depot'));
    await waitFor(() => expect(secondSession.result.current.data.fixedCost).toBe(3000));
  });
  it('rejects a stale save instead of overwriting another user', async () => {
    const depot = renderHook(() => useHppData('depot'));
    await waitFor(() => expect(depot.result.current.loading).toBe(false));
    mock.rows.set('depot', { materials: [], products: [], fixed_cost: 9000, version: 2 });
    await act(async () => { expect(await depot.result.current.save({ materials: [], products: [], fixedCost: 3000 })).toBe(false); });
    await waitFor(() => expect(depot.result.current.data.fixedCost).toBe(9000));
    expect(mock.writes).toEqual([]);
  });
});