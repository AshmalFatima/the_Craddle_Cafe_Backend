const mongoose = require('mongoose');
const StockIn = require('../models/StockIn');
const Product = require('../models/Product');
const authMiddleware = require('../authMiddleware');
const router = require('./productRoute');
const buildStockInQuery = require('../utils/buildStockInQuery');




router.post("/", authMiddleware, async (req, res) => {
    const { product, quantity, note, purchasePrice } = req.body;

    // Validate required fields
    if (!product || quantity === undefined || quantity === null || purchasePrice === undefined || purchasePrice === null) {
        return res.status(400).json({
            message: "Please provide product , purchase price and quantity"
        });
    }

    // Validate Product ID
    if (!mongoose.Types.ObjectId.isValid(product)) {
        return res.status(400).json({
            message: "Invalid product ID"
        });
    }

    // Validate quantity
    const qty = Number(quantity);
    const price = Number(purchasePrice);

    if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({
            message: "Quantity must be a valid positive number"
        });
    }

    if (isNaN(price) || price < 0) {
        return res.status(400).json({
            message: "Purchase price must be a valid non-negative number"
        });
    }

    // Validate note (optional)
    if (note !== undefined && typeof note !== "string") {
        return res.status(400).json({
            message: "Note must be a string"
        });
    }

    try {
        // Check if product exists
        const existingProduct = await Product.findById(product);

        if (!existingProduct) {
            return res.status(404).json({
                message: "Product not found"
            });
        }

        // Create stock history
        const newStockIn = await StockIn.create({
            product,
            quantity: qty,
            note: note?.trim() || "",
            purchasePrice : price,
            addedBy: req.user._id // Assuming authMiddleware sets req.user
        });

        // Update current stock
        await Product.findByIdAndUpdate(
            product,
            {
                $inc: { stock: qty }
            }
        );

        res.status(201).json({
            success: true,
            message: "Stock added successfully",
            stockIn: newStockIn
        });

    } catch (err) {
        console.error("Error adding stock:", err);
        res.status(500).json({
            message: "Server error"
        });
    }
});


router.get("/total", authMiddleware, async (req, res) => {

    try {

        const result = await buildStockInQuery(req.query);

        if (result.error) {
            return res.status(result.status).json({
                message: result.message
            });
        }

        const stockIns = await StockIn.find(result.query)
            .populate("product", "name sku variantName");

        const totalQuantity = stockIns.reduce(
            (sum, stock) => sum + stock.quantity,
            0
        );

        res.json({
            success: true,
            totalQuantity,
            stockIns
        });

    } catch (err) {

        console.error("Error calculating total stock:", err);

        res.status(500).json({
            message: "Server error"
        });

    }
});


router.get("/search", authMiddleware, async (req, res) => {
    try {

        const result = await buildStockInQuery(req.query);

        if (result.error) {
            return res.status(result.status).json({
                message: result.message
            });
        }

        const stockIns = await StockIn.find(result.query)
            .populate("product", "name sku variantName")
            .sort({ createdAt: -1 });

        if (!stockIns.length) {
            return res.status(404).json({
                message: "No stock-ins found."
            });
        }

        res.json({
            success: true,
            stockIns
        });

    } catch (err) {

        console.error("Error fetching stock-ins:", err);

        res.status(500).json({
            message: "Server error"
        });

    }
});

router.get('/', authMiddleware, async (req, res) => {
    try {
        const stockIns = await StockIn.find().populate('product', 'name variantName').sort({ createdAt: -1 });
        if (!stockIns || stockIns.length === 0) {   
            return res.status(404).json({ message: 'No stock ins found' });
        }
        res.json(stockIns);
    }   
    catch (err) {   
        console.error('Error fetching stock ins:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid stock in ID' });
    }
    try {
        const stockIn = await StockIn.findById(id).populate('product', 'name variantName');
        if (!stockIn) {
            return res.status(404).json({ message: 'Stock in not found' });
        }
        res.json(stockIn);
    } catch (err) {
        console.error('Error fetching stock in:', err);
        res.status(500).json({ message: 'Server error' });
    }
});


router.delete('/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid stock in ID' });
    }
    try {
        const stockIn = await StockIn.findById(id);
        if (!stockIn) { 
              return res.status(404).json({ message: 'Stock in not found' });
        }
        // Update the stock of the product before deleting the stock in record
        const product = await Product.findById(stockIn.product);
        if (product) {
            if (product.stock < stockIn.quantity) {
                return res.status(400).json({ message: 'Cannot delete stock in record as it would result in negative stock' });
            }
            product.stock -= stockIn.quantity;  
            if (product.stock < 0) {
                product.stock = 0; // Ensure stock doesn't go negative
            }
            await product.save();
        }
        await stockIn.remove();
        res.json({ message: 'Stock in record deleted successfully' });
    } catch (err) {
        console.error('Error deleting stock in:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.put('/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { quantity, note , purchasePrice } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid stock in ID' });
    }
    if (quantity === undefined || quantity === null || purchasePrice === undefined || purchasePrice === null) {
        return res.status(400).json({ message: 'Please provide quantity and purchase price' });
    }
    if (isNaN(purchasePrice) || Number(purchasePrice) < 0) {
        return res.status(400).json({ message: 'Purchase price must be a valid non-negative number' });
    }
    if (isNaN(quantity) || Number(quantity) <= 0) {
        return res.status(400).json({ message: 'Quantity must be a valid positive number' });
    }
    try {
        const stockIn = await StockIn.findById(id);
        if (!stockIn) {
            return res.status(404).json({ message: 'Stock in not found' });
        } 
        stockIn.quantity = quantity;
        stockIn.note = note || stockIn.note;
        stockIn.purchasePrice = purchasePrice;
        await stockIn.save();
        // Update the stock of the product
        const product = await Product.findById(stockIn.product);    
        product.stock += Number(quantity) - stockIn.quantity; // Adjust stock based on the new quantity
        if (product.stock < 0) {
            product.stock = 0; // Ensure stock doesn't go negative
        }
        await product.save();
        res.json({ message: 'Stock in record updated successfully', success: true });
    } catch (err) {
        console.error('Error updating stock in:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;