const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Category = require('../models/Category');



router.post('/', async (req, res) => {
    const { category, name, variantName, costPrice, sellingPrice , stock } = req.body;
    if (!category || !name || !variantName || !costPrice || !sellingPrice || !category.trim() || !name.trim() || !variantName.trim() || !costPrice.toString().trim() || !sellingPrice.toString().trim()) {
        return res.status(400).json({ message: 'Please provide all required fields' });
    }
    if (!mongoose.Types.ObjectId.isValid(category)) {
        return res.status(400).json({ message: 'Invalid category ID' });
    }
    if (isNaN(costPrice) || isNaN(sellingPrice)) {
        return res.status(400).json({ message: 'Cost price and selling price must be valid numbers' });
    }
    if (Number(costPrice) <= 0 || Number(sellingPrice) <= 0) {
        return res.status(400).json({ message: 'Cost price and selling price must be greater than 0' });
    }
    if(costPrice > sellingPrice){
        return res.status(400).json({ message: 'Cost price cannot be greater than selling price' });
    }
    if(isNaN(stock) || Number(stock) < 0){
        return res.status(400).json({ message: 'Stock must be a valid non-negative number' });
    }
    
    const sku = `${name.trim().substring(0,3).toUpperCase()}-${variantName.trim().substring(0,3).toUpperCase()}-${costPrice.toString().toUpperCase()}`; // Generate SKU based on name, variantName, and timestamp
    try {
        const existingProduct = await Product.findOne({ name: name.trim(), variantName: variantName.trim(), costPrice, category }); // Check if a product with the same name, variantName, costPrice, and category already exists
        if (existingProduct) {
            return res.status(400).json({ message: 'Product already exists' });
        }
        const newProduct = new Product({ category, name: name.trim(), variantName: variantName.trim(), costPrice, sku, sellingPrice , stock : stock?Number(stock):0 });
        await newProduct.save();
        res.status(201).json({ message: 'Product added successfully', success: true });

    } catch (err) {
        console.error('Error adding product:', err);
        res.status(500).json({ message: 'Server error' });
    }
});


router.get('/', async (req, res) => {
    try {
        const products =  await Product.find().populate('category', 'name').sort({createdAt: -1}); // Populate category name       
        if (!products || products.length === 0) {
            return res.status(404).json({ message: 'No products found' });
        }
        res.json(products);
    }
    catch (err) {
        console.error('Error fetching products:', err);
        res.status(500).json({ message: 'Server error' });
    }

});


router.put("/:id", async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Inavlid product ID" });
    }
    const {
        category,
        name,
        variantName,
        costPrice,
        sellingPrice,
        stock
    } = req.body;

    try {

        // Check if product exists
        const product = await Product.findById(id);

        if (!product) {
            return res.status(404).json({
                message: "Product not found"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(category)) {
            return res.status(400).json({ message: 'Invalid category ID' });
        }
        const categoryExists = await Category.findById(category);

        if (!categoryExists) {
            return res.status(404).json({ message: "Category not found" });
        }

        if(!name || !variantName || !costPrice || !sellingPrice || !name.trim() || !variantName.trim() || !costPrice.toString().trim() || !sellingPrice.toString().trim() || !stock.toString().trim()){ 
            return res.status(400).json({
                message: "Please provide name, variant name, stock , cost price and selling price"
            });
        }
        if (isNaN(costPrice) || isNaN(sellingPrice)) {
            return res.status(400).json({
                message: "Cost price and selling price must be valid numbers"
            });
        }
        if (Number(costPrice) <= 0 || Number(sellingPrice) <= 0) {
            return res.status(400).json({
                message: "Cost price and selling price must be greater than 0"
            });
        }
        if(costPrice > sellingPrice){
            return res.status(400).json({
                message: "Cost price cannot be greater than selling price"
            });
        }
        if(isNaN(stock) || Number(stock) < 0){
            return res.status(400).json({
                message: "Stock must be a valid non-negative number"
            });
        }
        // Check if another product with the same details already exists
        const existingProduct = await Product.findOne({
            _id: { $ne: id }, // Ignore current product
            category,
            name,
            variantName,
            costPrice
        });

        if (existingProduct) {
            return res.status(400).json({
                message: "Product already exists."
            });
        }

        
        // Update product
        const updatedProduct = await Product.findByIdAndUpdate(
            id,
            {
                category,
                name,
                variantName,
                costPrice,
                sellingPrice,
                stock  // If stock is provided, update it; otherwise, keep the existing stock
        
            },
            {
                new: true,
                runValidators: true
            }
        ).populate("category", "name");

        res.status(200).json({ message: "Product updated successfully", updatedProduct });

    } catch (err) {
        console.error("Error updating product:", err);
        res.status(500).json({
            message: "Server Error"
        });
    }
});


router.delete('/:id', async (req, res) => {
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
        res.json({ message: 'Product deleted successfully' });
    } catch (err) {
        console.error('Error deleting product:', err);
        res.status(500).json({ message: 'Server error' });
    }
});


router.get("/search/:search", async (req, res) => {
    const { search } = req.params;

    try {
        let filter = {};

        if (search) {
            // Find matching categories first
            const categories = await Category.find({
                name: { $regex: search, $options: "i" }
            }).select("_id");

            const categoryIds = categories.map(cat => cat._id);

            filter = {
                $or: [
                    { name: { $regex: search, $options: "i" } },
                    { sku: { $regex: search, $options: "i" } },
                    { category: { $in: categoryIds } }
                ]
            };
        }

        const products = await Product.find(filter)
            .populate("category", "name");

        res.status(200).json(products);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error" });
    }
});


// Filter products by category and/or price range
router.get("/filter", async (req, res) => {
    const { category, minPrice, maxPrice } = req.query;

    // User must provide at least one filter
    if (!category && !minPrice && !maxPrice) {
        return res.status(400).json({
            message: "Please provide at least one filter."
        });
    }

    if (category && !mongoose.Types.ObjectId.isValid(category)) {
        return res.status(400).json({
            message: "Invalid category ID."
        });
    }

    // Validate price values
    if (minPrice && isNaN(minPrice)) {
        return res.status(400).json({
            message: "Minimum price must be a valid number."
        });
    }

    if (maxPrice && isNaN(maxPrice)) {
        return res.status(400).json({
            message: "Maximum price must be a valid number."
        });
    }

    if (minPrice && Number(minPrice) <= 0) {
        return res.status(400).json({
            message: "Minimum price cannot be less than or equal to 0."
        });
    }

    if (maxPrice && Number(maxPrice) <= 0) {
        return res.status(400).json({
            message: "Maximum price cannot be less than or equal to 0."
        });
    }

    // Check if min price is greater than max price
    if (
        minPrice &&
        maxPrice &&
        Number(minPrice) > Number(maxPrice)
    ) {
        return res.status(400).json({
            message: "Minimum price cannot be greater than maximum price."
        });
    }

    try {
        let filter = {};

        // Filter by category (expects Category ObjectId)
        if (category) {
            filter.category = category;
        }

        // Filter by minimum price
        if (minPrice) {
            filter.sellingPrice = {
                ...filter.sellingPrice,
                $gte: Number(minPrice)
            };
        }

        // Filter by maximum price
        if (maxPrice) {
            filter.sellingPrice = {
                ...filter.sellingPrice,
                $lte: Number(maxPrice)
            };
        }

        // Find matching products and populate category name
        const products = await Product.find(filter)
            .populate("category", "name");

        res.status(200).json(products);

    } catch (err) {
        console.error("Error filtering products:", err);
        res.status(500).json({
            message: "Server Error"
        });
    }
});


router.get("/active", async (req, res) => {
    try {
        const activeProducts = await Product.find({ isActive: true }).populate("category", "name");
        res.status(200).json(activeProducts);
    } catch (err) {
        console.error("Error fetching active products:", err);
        res.status(500).json({
            message: "Server Error"
        });
    }
});


router.get("/inactive", async (req, res) => {
    try {
        const inactiveProducts = await Product.find({ isActive: false }).populate("category", "name");
        res.status(200).json(inactiveProducts);
    } catch (err) {
        console.error("Error fetching inactive products:", err);
        res.status(500).json({
            message: "Server Error"
        });
    }
});








module.exports = router;