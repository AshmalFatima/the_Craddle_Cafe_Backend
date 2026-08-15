const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Product = require('../models/product');
const Category = require('../models/category');
const StockIn = require('../models/stockIn');
const authMiddleware = require('../authMiddleWare');


// CREATE product + initial stock-in entry
router.post('/', authMiddleware, async (req, res) => {
    const { category, name, variantName, petStock, itemsPerPet, sellingPrice, petPrice } = req.body;

    if (!category || !name || !variantName || !petStock || !itemsPerPet || !sellingPrice || !petPrice ||
        !category.trim() || !name.trim() || !variantName.trim() || !petStock.toString().trim() ||
        !itemsPerPet.toString().trim() || !sellingPrice.toString().trim() || !petPrice.toString().trim()) {
        return res.status(400).json({
            message: "Please provide category, name, variant name, stock, pet price and selling price"
        });
    }
    if (!mongoose.Types.ObjectId.isValid(category)) {
        return res.status(400).json({ message: 'Invalid category ID' });
    }
    if (isNaN(petStock) || isNaN(itemsPerPet) || isNaN(sellingPrice) || isNaN(petPrice)) {
        return res.status(400).json({ message: 'Stock and selling price must be valid numbers' });
    }
    if (Number(petStock) <= 0 || Number(itemsPerPet) <= 0 || Number(sellingPrice) <= 0 || Number(petPrice) <= 0) {
        return res.status(400).json({ message: 'Stock and selling price must be greater than 0' });
    }

    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
        return res.status(404).json({ message: 'Category not found' });
    }

    const unitPrice = Number(petPrice) / Number(itemsPerPet);
    const sellingPriceNum = Number(sellingPrice);

    if (unitPrice > sellingPriceNum) {
        return res.status(400).json({
            message: "Selling price cannot be less than cost price"
        });
    }

    const unitStock = Number(itemsPerPet) * Number(petStock);
const cleanName = name.trim().toUpperCase().replace(/\s+/g, '');
const cleanVariant = variantName.trim().toUpperCase().replace(/\s+/g, '');

const sku = `${cleanName.substring(0, 6)}-${cleanVariant.substring(0, 6)}-${unitPrice
  .toFixed(2)
  .replace('.', '')}`;

    try {
        const existingProduct = await Product.findOne({ name: name.trim(), variantName: variantName.trim(), category });
        if (existingProduct) {
            return res.status(400).json({ message: 'Product already exists' });
        }

        const newProduct = new Product({
            category,
            name: name.trim(),
            variantName: variantName.trim(),
            unitPrice,
            petPrice: Number(petPrice),
            sku,
            itemsPerPet: Number(itemsPerPet),
            sellingPrice: sellingPriceNum,
            petStock: Number(petStock),
            unitStock
        });

        await newProduct.save();

        const stockSellingPrice = sellingPriceNum * unitStock;
        const stockCostPrice = Number(petPrice) * Number(petStock);

        const stockInEntry = new StockIn({
            product: newProduct._id,
            type: 'in',
            petStock: Number(petStock),
            unitStock,
            itemsPerPet: Number(itemsPerPet),
            unitPrice,
            petPrice: Number(petPrice),
            stockSellingPrice,
            stockCostPrice,
            profit: stockSellingPrice - stockCostPrice,
        });
        await stockInEntry.save();

        const populated = await Product.findById(newProduct._id).populate('category', 'name');

        res.status(201).json({ message: 'Product added successfully', success: true, product: populated });

    } catch (err) {
        console.error('Error adding product:', err);
        res.status(500).json({ message: err});
    }
});


// LIST all products
router.get('/', authMiddleware, async (req, res) => {
    try {
        const products = await Product.find().populate('category', 'name').sort({ createdAt: -1 });
        res.json(products || []);
    } catch (err) {
        console.error('Error fetching products:', err);
        res.status(500).json({ message: 'Server error' });
    }
});


// UPDATE product details only (name, variant, category, petPrice, sellingPrice, itemsPerPet)
// Stock quantities are never touched here — use /api/stock/in and /api/stock/out for that.
router.put("/:id", authMiddleware, async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid product ID" });
    }

    const { category, name, variantName, petPrice, sellingPrice, itemsPerPet } = req.body;

    if (!name || !variantName || !name.trim() || !variantName.trim() || !category || !category.trim()) {
        return res.status(400).json({
            message: "Please provide name, variant name, and category"
        });
    }
    if (!mongoose.Types.ObjectId.isValid(category)) {
        return res.status(400).json({ message: 'Invalid category ID' });
    }
    if (isNaN(petPrice) || isNaN(sellingPrice) || Number(petPrice) <= 0 || Number(sellingPrice) <= 0) {
        return res.status(400).json({
            message: "Pet price and selling price must be valid numbers greater than 0"
        });
    }
    if (isNaN(itemsPerPet) || Number(itemsPerPet) <= 0) {
        return res.status(400).json({
            message: "Items per pet must be a valid number greater than 0"
        });
    }

    try {
        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        const categoryExists = await Category.findById(category);
        if (!categoryExists) {
            return res.status(404).json({ message: "Category not found" });
        }

        const existingProduct = await Product.findOne({
            _id: { $ne: id },
            category,
            name: name.trim(),
            variantName: variantName.trim()
        });
        if (existingProduct) {
            return res.status(400).json({ message: "Product already exists." });
        }

        const newItemsPerPet = Number(itemsPerPet);
        const newPetPrice = Number(petPrice);
        const newSellingPrice = Number(sellingPrice);

        // recompute cost basis off the NEW petPrice / itemsPerPet (bug fix: used to reference
        // an undefined `products.itemsPerPet`, which crashed this route)
        const unitPrice = newPetPrice / newItemsPerPet;

        if (unitPrice > newSellingPrice) {
            return res.status(400).json({ message: "Selling price cannot be less than cost price" });
        }

        // petStock (number of cartons/pets) doesn't change here, but unitStock must be
        // recalculated if itemsPerPet changed
        const unitStock = product.petStock * newItemsPerPet;

        const sku = `${name.trim().substring(0, 3).toUpperCase()}-${variantName.trim().substring(0, 3).toUpperCase()}-${product.sku.split('-').pop()}`;

        const updatedProduct = await Product.findByIdAndUpdate(
            id,
            {
                category,
                name: name.trim(),
                variantName: variantName.trim(),
                unitPrice,
                sellingPrice: newSellingPrice,
                sku,
                petPrice: newPetPrice,
                itemsPerPet: newItemsPerPet,
                unitStock
            },
            { new: true, runValidators: true }
        ).populate("category", "name");

        res.status(200).json({ message: "Product updated successfully", updatedProduct });

    } catch (err) {
        console.error("Error updating product:", err);
        res.status(500).json({ message: "Server error" });
    }
});


router.delete('/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid product ID" });
    }

    try {
        let product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        await Product.findByIdAndDelete(id);
        await StockIn.deleteMany({ product: id });
        res.json({ message: 'Product deleted successfully' });
    } catch (err) {
        console.error('Error deleting product:', err);
        res.status(500).json({ message: 'Server error' });
    }
});


module.exports = router;
