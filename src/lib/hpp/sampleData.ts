        export const SAMPLE_MATERIALS = [
            { id: 'm1', name: 'Biji Kopi Arabika Espresso Blend', category: 'Bahan Utama', buyUnit: 'kg', buyPrice: 180000, buyQty: 1, baseUnit: 'gram', costPerBaseUnit: 180 },
            { id: 'm2', name: 'Susu UHT Full Cream', category: 'Bahan Utama', buyUnit: 'liter', buyPrice: 19500, buyQty: 1, baseUnit: 'ml', costPerBaseUnit: 19.5 },
            { id: 'm3', name: 'Sirup Gula Aren Cair', category: 'Bumbu & Rasa', buyUnit: 'liter', buyPrice: 35000, buyQty: 1, baseUnit: 'ml', costPerBaseUnit: 35 },
            { id: 'm4', name: 'Cup Plastic 16oz + Lid', category: 'Kemasan', buyUnit: 'pcs', buyPrice: 650, buyQty: 1, baseUnit: 'pcs', costPerBaseUnit: 650 },
            { id: 'm5', name: 'Sedotan Steril Bio', category: 'Kemasan', buyUnit: 'pcs', buyPrice: 150, buyQty: 1, baseUnit: 'pcs', costPerBaseUnit: 150 },
            { id: 'm6', name: 'Es Batu Kristal', category: 'Bahan Utama', buyUnit: 'kg', buyPrice: 10000, buyQty: 10, baseUnit: 'gram', costPerBaseUnit: 1 },
            { id: 'm7', name: 'Daging Sapi Slice', category: 'Bahan Utama', buyUnit: 'kg', buyPrice: 120000, buyQty: 1, baseUnit: 'gram', costPerBaseUnit: 120 },
            { id: 'm8', name: 'Beras Pulen Super', category: 'Bahan Utama', buyUnit: 'kg', buyPrice: 15000, buyQty: 1, baseUnit: 'gram', costPerBaseUnit: 15 },
        ];

        export const SAMPLE_PRODUCTS = [
            {
                id: 'p1',
                name: 'Kopi Susu Gula Aren 16oz',
                category: 'Minuman',
                targetMargin: 65,
                customSellingPrice: 22000,
                overheadCostPerUnit: 1000,
                ingredients: [
                    { materialId: 'm1', qty: 18, unit: 'gram' },
                    { materialId: 'm2', qty: 120, unit: 'ml' },
                    { materialId: 'm3', qty: 25, unit: 'ml' },
                    { materialId: 'm4', qty: 1, unit: 'pcs' },
                    { materialId: 'm5', qty: 1, unit: 'pcs' },
                    { materialId: 'm6', qty: 150, unit: 'gram' }
                ]
            },
            {
                id: 'p2',
                name: 'Ricebowl Beef Slice Original',
                category: 'Makanan Utama',
                targetMargin: 55,
                customSellingPrice: 35000,
                overheadCostPerUnit: 2500,
                ingredients: [
                    { materialId: 'm7', qty: 100, unit: 'gram' },
                    { materialId: 'm8', qty: 150, unit: 'gram' },
                    { materialId: 'm4', qty: 1, unit: 'pcs' }
                ]
            }
        ];

