import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ row: { id: 1, materials: [], products: [], fixed_cost: 8000000, version: 1 }, expected: 1, update: {} as Record<string, unknown> }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: (table: string) => {
  if (table !== 'hpp_workspaces') throw new Error('Wrong shared table');
  const query = {
    select: () => query,
    eq: (column: string, value: number) => { if (column === 'version') state.expected = value; return query; },
    single: async () => ({ data: { ...state.row }, error: null }),
    update: (value: Record<string, unknown>) => { state.update = value; return query; },
    maybeSingle: async () => {
      if (state.expected !== state.row.version) return { data: null, error: null };
      state.row = { ...state.row, ...state.update, version: state.row.version + 1 };
      return { data: { ...state.row }, error: null };
    },
  };
  return query;
} } }));
import { useHppData } from './useHppData';

describe('shared HPP workspace', () => {
  beforeEach(() => { state.row = { id: 1, materials: [], products: [], fixed_cost: 8000000, version: 1 }; localStorage.clear(); });
  it('reads changes saved by one account from another account without local storage', async () => {
    const first = renderHook(() => useHppData('account-one'));
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    await act(async () => { expect(await first.result.current.save({ materials: [], products: [], fixedCost: 123456 })).toBe(true); });
    first.unmount();
    const second = renderHook(() => useHppData('account-two'));
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(second.result.current.data.fixedCost).toBe(123456);
    expect(localStorage.length).toBe(0);
    second.unmount();
  });
  it('rejects stale saves rather than overwriting changes from another account', async () => {
    const first = renderHook(() => useHppData('account-one'));
    const second = renderHook(() => useHppData('account-two'));
    await waitFor(() => expect(first.result.current.loading || second.result.current.loading).toBe(false));
    await act(async () => { await first.result.current.save({ materials: [], products: [], fixedCost: 9000000 }); });
    await act(async () => { expect(await second.result.current.save({ materials: [], products: [], fixedCost: 1 })).toBe(false); });
    expect(state.row.fixed_cost).toBe(9000000);
    await waitFor(() => expect(second.result.current.data.fixedCost).toBe(9000000));
    first.unmount(); second.unmount();
  });
});