export const UNITS = ['kg', 'gram', 'liter', 'ml', 'pcs', 'pack'] as const;
export type Unit = typeof UNITS[number];
export interface Material {
  id: string; name: string; category: string; buyUnit: string; buyPrice: number; buyQty: number;
  baseUnit: string; costPerBaseUnit: number;
}
export interface Ingredient { materialId: string; qty: number; unit: string }
export interface Product {
  id: string; name: string; category: string; targetMargin: number;
  customSellingPrice: number; overheadCostPerUnit: number; ingredients: Ingredient[];
}
export const rupiah = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
export function baseUnitInfo(unit: string, price: number, qty: number) {
  if (!UNITS.includes(unit as Unit) || !Number.isFinite(price) || price < 0 || !Number.isFinite(qty) || qty <= 0) throw new Error('Harga harus positif atau nol, jumlah pembelian harus lebih dari nol, dan satuan harus valid.');
  const baseUnit = unit === 'kg' ? 'gram' : unit === 'liter' ? 'ml' : unit;
  return { baseUnit, costPerBaseUnit: price / (qty * (unit === 'kg' || unit === 'liter' ? 1000 : 1)) };
}
export function compatibleUnits(baseUnit: string) {
  return baseUnit === 'gram' ? ['gram', 'kg'] : baseUnit === 'ml' ? ['ml', 'liter'] : [baseUnit];
}
export function calculateHpp(product: Product, materials: Material[]) {
  const breakdown = product.ingredients.map(ingredient => {
    const material = materials.find(m => m.id === ingredient.materialId);
    if (!material || !compatibleUnits(material.baseUnit).includes(ingredient.unit)) throw new Error('Bahan atau satuan resep tidak sesuai.');
    const factor = ingredient.unit === 'kg' || ingredient.unit === 'liter' ? 1000 : 1;
    return { ...ingredient, matName: material.name, totalCost: ingredient.qty * factor * material.costPerBaseUnit };
  });
  const ingredientCost = breakdown.reduce((sum, row) => sum + row.totalCost, 0);
  const totalHPP = ingredientCost + product.overheadCostPerUnit;
  const recommendedPrice = totalHPP / (1 - product.targetMargin / 100);
  const actualPrice = product.customSellingPrice > 0 ? product.customSellingPrice : recommendedPrice;
  const profitPerUnit = actualPrice - totalHPP;
  return { breakdown, ingredientCost, totalHPP, recommendedPrice, actualPrice, profitPerUnit,
    actualMarginPercent: actualPrice > 0 ? profitPerUnit / actualPrice * 100 : 0,
    foodCostPercent: actualPrice > 0 ? totalHPP / actualPrice * 100 : 0 };
}
export function calculateBep(fixedCost: number, contribution: number, sellingPrice: number) {
  if (contribution <= 0) return null;
  const units = Math.ceil(fixedCost / contribution);
  return { units, revenue: units * sellingPrice, daily: Math.ceil(units / 30) };
}
export function validateProduct(product: Product, materials: Material[]) {
  if (!product.name.trim() || product.ingredients.length === 0) throw new Error('Nama menu dan minimal satu bahan wajib diisi.');
  if (!Number.isFinite(product.targetMargin) || product.targetMargin < 0 || product.targetMargin >= 100) throw new Error('Target margin harus 0 sampai kurang dari 100%.');
  if (!Number.isFinite(product.customSellingPrice) || product.customSellingPrice < 0 || !Number.isFinite(product.overheadCostPerUnit) || product.overheadCostPerUnit < 0) throw new Error('Harga jual dan biaya operasional tidak boleh negatif.');
  if (product.ingredients.some(i => !Number.isFinite(i.qty) || i.qty <= 0)) throw new Error('Takaran setiap bahan harus lebih dari nol.');
  calculateHpp(product, materials);
}