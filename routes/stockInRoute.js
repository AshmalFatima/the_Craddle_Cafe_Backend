const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const StockIn = require('../models/StockIn');
const Product = require('../models/Product');
const authMiddleware = require('../authMiddleWare');


// Shared helper: a movement can be specified either in whole pets/cartons (petStock)
// or in individual units (unitStock) — e.g. a pet of 6 bottles, removing 7 bottles
// leaves a fractional 5 - 7/6 = 3.8333 pets. Whichever one is provided, the other is
// derived from the product's itemsPerPet. Units are treated as the atomic quantity
// (rounded to whole numbers); pets are allowed to be fractional.
function resolveMovementQuantity({ petStock, unitStock, itemsPerPet }) {
    if (unitStock !== undefined && unitStock !== null && unitStock !== '') {
        const units = Number(unitStock);
        if (isNaN(units) || units <= 0) return { error: 'Units must be a valid positive number' };
        return { units: Math.round(units), pets: Number((units / itemsPerPet).toFixed(4)) };
    }
    if (petStock !== undefined && petStock !== null && petStock !== '') {
        const pets = Number(petStock);
        if (isNaN(pets) || pets <= 0) return { error: 'Pet stock must be a valid positive number' };
        return { units: Math.round(pets * itemsPerPet), pets: Number(pets.toFixed(4)) };
    }
    return { error: 'Please provide either petStock or unitStock' };
}

// STOCK IN — add more stock to an existing product, either in whole pets/cartons
// (typical for a new delivery) or in individual units.
// Pricing (petPrice, itemsPerPet, sellingPrice) is locked to the product's current values —
// only the quantity changes here. To change pricing, edit the product itself.
router.post('/in', authMiddleware, async (req, res) => {
    const { product, petStock, unitStock, note } = req.body;

    if (!product) {
        return res.status(400).json({ message: "Please provide a product" });
    }
    if (!mongoose.Types.ObjectId.isValid(product)) {
        return res.status(400).json({ message: "Invalid product ID" });
    }

    try {
        const existingProduct = await Product.findById(product);
        if (!existingProduct) {
            return res.status(404).json({ message: "Product not found" });
        }

        const { itemsPerPet, unitPrice, petPrice, sellingPrice } = existingProduct;
        const resolved = resolveMovementQuantity({ petStock, unitStock, itemsPerPet });
        if (resolved.error) {
            return res.status(400).json({ message: resolved.error });
        }
        const { units, pets } = resolved;

        const stockCostPrice = unitPrice * units;
        const stockSellingPrice = sellingPrice * units;
        const profit = stockSellingPrice - stockCostPrice;

        const stockEntry = await StockIn.create({
            product,
            type: 'in',
            petStock: pets,
            unitStock: units,
            itemsPerPet,
            unitPrice,
            petPrice,
            stockSellingPrice,
            stockCostPrice,
            profit,
            note: note || ''
        });

        existingProduct.petStock = Number((existingProduct.petStock + pets).toFixed(4));
        existingProduct.unitStock += units;
        await existingProduct.save();

        const populated = await Product.findById(product).populate('category', 'name');

        res.status(201).json({
            success: true,
            message: "Stock added successfully",
            stockEntry,
            product: populated
        });
    } catch (err) {
        console.error("Error adding stock:", err);
        res.status(500).json({ message: "Server error" });
    }
});


// STOCK OUT — remove stock from an existing product (sold, damaged, etc.), either in
// whole pets/cartons or in individual units. Removing by units can leave a fractional
// pet count — e.g. 5 pets of 6 units each (30 units), remove 7 units -> 23 units left
// -> 23/6 = 3.8333 pets remaining.
router.post('/out', authMiddleware, async (req, res) => {
    const { product, petStock, unitStock, note } = req.body;

    if (!product) {
        return res.status(400).json({ message: "Please provide a product" });
    }
    if (!mongoose.Types.ObjectId.isValid(product)) {
        return res.status(400).json({ message: "Invalid product ID" });
    }

    try {
        const existingProduct = await Product.findById(product);
        if (!existingProduct) {
            return res.status(404).json({ message: "Product not found" });
        }

        const { itemsPerPet, unitPrice, petPrice, sellingPrice } = existingProduct;
        const resolved = resolveMovementQuantity({ petStock, unitStock, itemsPerPet });
        if (resolved.error) {
            return res.status(400).json({ message: resolved.error });
        }
        const { units, pets } = resolved;

        // Compare on units — the atomic, integer quantity — to avoid drift from
        // repeated fractional-pet rounding.
        if (units > existingProduct.unitStock) {
            return res.status(400).json({ message: "Not enough stock available for this product" });
        }

        const stockCostPrice = unitPrice * units;
        const stockSellingPrice = sellingPrice * units;
        const profit = stockSellingPrice - stockCostPrice;

        const stockEntry = await StockIn.create({
            product,
            type: 'out',
            petStock: pets,
            unitStock: units,
            itemsPerPet,
            unitPrice,
            petPrice,
            stockSellingPrice,
            stockCostPrice,
            profit,
            note: note || ''
        });

        existingProduct.unitStock -= units;
        existingProduct.petStock = Number((existingProduct.unitStock / itemsPerPet).toFixed(4));
        if (existingProduct.unitStock < 0) existingProduct.unitStock = 0;
        if (existingProduct.petStock < 0) existingProduct.petStock = 0;
        await existingProduct.save();

        const populated = await Product.findById(product).populate('category', 'name');

        res.status(201).json({
            success: true,
            message: "Stock removed successfully",
            stockEntry,
            product: populated
        });
    } catch (err) {
        console.error("Error removing stock:", err);
        res.status(500).json({ message: "Server error" });
    }
});


// EDIT / ADJUST A STOCK MOVEMENT
// The user enters a whole number of pets and chooses whether to
// add or remove that many pets from the existing movement.
//
// Example:
// Stock In = 12 pets
// Remove 2 pets -> movement becomes 10 pets
//
// Stock Out = 12 pets
// Remove 2 pets -> movement becomes 10 pets and 2 pets are
// returned to the product's current stock.
router.put('/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { action, pets } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            message: 'Invalid stock record ID'
        });
    }

    if (!['add', 'remove'].includes(action)) {
        return res.status(400).json({
            message: 'Action must be either add or remove'
        });
    }

    const adjustmentPets = Number(pets);

    if (
        !Number.isInteger(adjustmentPets) ||
        adjustmentPets <= 0
    ) {
        return res.status(400).json({
            message: 'Pets must be a positive whole number'
        });
    }

    try {
        const stockEntry = await StockIn.findById(id);

        if (!stockEntry) {
            return res.status(404).json({
                message: 'Stock record not found'
            });
        }

        const product = await Product.findById(stockEntry.product);

        if (!product) {
            return res.status(404).json({
                message: 'Product not found'
            });
        }

        const itemsPerPet = stockEntry.itemsPerPet;

        if (!Number.isInteger(itemsPerPet) || itemsPerPet <= 0) {
            return res.status(400).json({
                message: 'Invalid items per pet on stock record'
            });
        }

        const oldPets = Number(stockEntry.petStock);
        const oldUnits = Number(stockEntry.unitStock);

        let newPets;

        if (action === 'add') {
            newPets = oldPets + adjustmentPets;
        } else {
            newPets = oldPets - adjustmentPets;
        }

        // A stock movement itself cannot become negative.
        if (newPets < 0) {
            return res.status(400).json({
                message: `Cannot remove ${adjustmentPets} pets. This record only contains ${oldPets} pets.`
            });
        }

        const adjustmentUnits = adjustmentPets * itemsPerPet;

        /*
         * Determine how current product stock changes.
         *
         * STOCK IN:
         *   add    -> product stock increases
         *   remove -> product stock decreases
         *
         * STOCK OUT:
         *   add    -> product stock decreases
         *   remove -> product stock increases
         */
        let productUnitDelta = 0;

        if (stockEntry.type === 'in') {
            productUnitDelta =
                action === 'add'
                    ? adjustmentUnits
                    : -adjustmentUnits;
        } else {
            productUnitDelta =
                action === 'add'
                    ? -adjustmentUnits
                    : adjustmentUnits;
        }

        const newProductUnits =
            Number(product.unitStock) + productUnitDelta;

        if (newProductUnits < 0) {
            return res.status(400).json({
                message: 'This adjustment would result in negative product stock'
            });
        }

        const newProductPets = Number(
            (newProductUnits / product.itemsPerPet).toFixed(4)
        );

        // Update movement
        const newUnits = newPets * itemsPerPet;

        stockEntry.petStock = newPets;
        stockEntry.unitStock = newUnits;

        // Recalculate financial snapshot
        stockEntry.stockCostPrice =
            stockEntry.unitPrice * newUnits;

        stockEntry.stockSellingPrice =
            stockEntry.stockSellingPrice / oldUnits * newUnits;

        stockEntry.profit =
            stockEntry.stockSellingPrice -
            stockEntry.stockCostPrice;

        // Update product current stock
        product.unitStock = newProductUnits;
        product.petStock = newProductPets;

        await product.save();
        await stockEntry.save();

        const populated = await StockIn.findById(id)
            .populate('product', 'name variantName');

        res.json({
            success: true,
            message: 'Stock movement updated successfully',
            stockEntry: populated,
            product
        });

    } catch (err) {
        console.error('Error editing stock movement:', err);

        res.status(500).json({
            message: 'Server error'
        });
    }
});

// ALL movements (admin overview)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const stockIns = await StockIn.find().populate('product', 'name variantName').sort({ createdAt: -1 });
        res.json(stockIns || []);
    } catch (err) {
        console.error('Error fetching stock history:', err);
        res.status(500).json({ message: 'Server error' });
    }
});


// History for ONE product, filterable by type + date range
router.get('/history/:productId', authMiddleware, async (req, res) => {
    const { productId } = req.params;
    const { type, startDate, endDate } = req.query;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ message: 'Invalid product ID' });
    }

    const query = { product: productId };
    if (type && ['in', 'out'].includes(type)) {
        query.type = type;
    }
    if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            query.createdAt.$lte = end;
        }
    }

    try {
        const history = await StockIn.find(query).populate('product', 'name variantName').sort({ createdAt: -1 });
        res.json(history);
    } catch (err) {
        console.error('Error fetching product stock history:', err);
        res.status(500).json({ message: 'Server error' });
    }
});


router.get('/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid stock record ID' });
    }
    try {
        const stockEntry = await StockIn.findById(id).populate('product', 'name variantName');
        if (!stockEntry) {
            return res.status(404).json({ message: 'Stock record not found' });
        }
        res.json(stockEntry);
    } catch (err) {
        console.error('Error fetching stock record:', err);
        res.status(500).json({ message: 'Server error' });
    }
});


// Delete a stock movement and reverse its effect on the product's current stock
router.delete('/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid stock record ID' });
    }
    try {
        const stockEntry = await StockIn.findById(id);
        if (!stockEntry) {
            return res.status(404).json({ message: 'Stock record not found' });
        }

        const product = await Product.findById(stockEntry.product);
        if (product) {
            if (stockEntry.type === 'in') {
                if (stockEntry.unitStock > product.unitStock) {
                    return res.status(400).json({ message: 'Cannot delete: would result in negative stock' });
                }
                product.unitStock -= stockEntry.unitStock;
            } else {
                product.unitStock += stockEntry.unitStock;
            }
            if (product.unitStock < 0) product.unitStock = 0;
            // recompute pets from units so fractional pets stay consistent
            product.petStock = Number((product.unitStock / product.itemsPerPet).toFixed(4));
            await product.save();
        }

        await stockEntry.deleteOne();
        res.json({ message: 'Stock record deleted successfully' });
    } catch (err) {
        console.error('Error deleting stock record:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;