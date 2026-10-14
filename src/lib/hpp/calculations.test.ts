import { describe, it, expect } from 'vitest';
import { baseUnitInfo, calculateHpp, calculateBep, validateProduct } from './calculations';
import { SAMPLE_MATERIALS, SAMPLE_PRODUCTS } from './sampleData';
import { importHppCsv, MATERIAL_HEADER, PRODUCT_HEADER } from './csv';

describe('HPP calculator from supplied source', () => {
  it('converts 1 kg bought at 180000 into 180 per gram', () => {
    expect(baseUnitInfo('kg', 180000, 1)).toEqual({ baseUnit: 'gram', costPerBaseUnit: 180 });
  });
  it('includes every ingredient and per-portion overhead', () => {
    expect(calculateHpp(SAMPLE_PRODUCTS[0], SAMPLE_MATERIALS).totalHPP).toBe(8405);
  });
  it('calculates a selling price based on margin rather than markup', () => {
    const result = calculateHpp({ ...SAMPLE_PRODUCTS[0], targetMargin: 65, customSellingPrice: 0 }, SAMPLE_MATERIALS);
    expect(result.recommendedPrice).toBeCloseTo(24014.285714);
    expect(result.actualMarginPercent).toBeCloseTo(65);
  });
  it('respects a zero margin without falling back to 50 percent', () => {
    expect(calculateHpp({ ...SAMPLE_PRODUCTS[0], targetMargin: 0, customSellingPrice: 0 }, SAMPLE_MATERIALS).recommendedPrice).toBe(8405);
  });
  it('supports recipe quantities expressed in kg', () => {
    expect(calculateHpp({ ...SAMPLE_PRODUCTS[0], overheadCostPerUnit: 0, ingredients: [{ materialId: 'm1', qty: 0.018, unit: 'kg' }] }, SAMPLE_MATERIALS).totalHPP).toBeCloseTo(3240);
  });
  it('rejects physically incompatible units', () => {
    expect(() => calculateHpp({ ...SAMPLE_PRODUCTS[0], ingredients: [{ materialId: 'm1', qty: 18, unit: 'ml' }] }, SAMPLE_MATERIALS)).toThrow();
  });
  it('rounds BEP upward and daily target using 30 days', () => {
    expect(calculateBep(8000000, 13595, 22000)).toEqual({ units: 589, revenue: 12958000, daily: 20 });
  });
  it('does not report zero sales as break-even for loss-making products', () => {
    expect(calculateBep(8000000, -1000, 5000)).toBeNull();
  });
  it('rejects 100 percent target margin', () => {
    expect(() => validateProduct({ ...SAMPLE_PRODUCTS[0], targetMargin: 100 }, SAMPLE_MATERIALS)).toThrow();
  });
  it('rejects zero purchase quantity', () => {
    expect(() => baseUnitInfo('kg', 180000, 0)).toThrow();
  });
  it('groups multiple rows into one recipe', () => {
    const csv = [PRODUCT_HEADER.join(','), 'Test,Minuman,65,22000,1000,Biji Kopi Arabika Espresso Blend,18,gram', 'Test,Minuman,65,22000,1000,Susu UHT Full Cream,120,ml'].join('\n');
    const result = importHppCsv(csv, 'products', SAMPLE_MATERIALS, []);
    expect(result.products).toHaveLength(1);
    expect(result.products[0].ingredients).toHaveLength(2);
    expect(calculateHpp(result.products[0], result.materials).totalHPP).toBe(6580);
  });
  it('rejects unknown ingredients rather than silently costing them at zero', () => {
    expect(() => importHppCsv(PRODUCT_HEADER.join(',') + '\nTest,Minuman,60,20000,1000,Unknown,1,pcs', 'products', SAMPLE_MATERIALS, [])).toThrow('belum ada');
  });
  it('accepts semicolon CSV with decimal comma quantities', () => {
    const result = importHppCsv(MATERIAL_HEADER.join(';') + '\nTest;Bahan Utama;90000;kg;0,5', 'materials', [], []);
    expect(result.materials[0].costPerBaseUnit).toBe(180);
  });
  it('validates whole import before returning updates', () => {
    const materials = [...SAMPLE_MATERIALS];
    expect(() => importHppCsv(MATERIAL_HEADER.join(',') + '\nNew,Bahan Utama,1000,pcs,1\nInvalid,Bahan Utama,1000,pcs,0', 'materials', materials, [])).toThrow('Baris 3');
    expect(materials).toHaveLength(8);
  });
});