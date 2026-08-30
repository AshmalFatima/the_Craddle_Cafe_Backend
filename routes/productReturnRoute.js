const mongoose = require('mongoose');
const express = require('express');
const router = express.Router();
const Product = require('../models/product');
const StockIn = require('../models/stockIn');
const Expense = require('../models/expense');
const ProductReturn = require('../models/productReturn'); // was missing
const authMiddleware = require('../authMiddleWare');

router.post('/return', authMiddleware, async (req, res) => {
  const { productId, quantity, returnType, returnAmount, reason, note } = req.body;

  if (!productId || !quantity || !returnType || returnAmount === undefined || !reason) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({ message: 'Invalid product ID' });
  }
  if (!['unit', 'pet'].includes(returnType)) {
    return res.status(400).json({ message: 'returnType must be unit or pet' });
  }

  const qty = Number(quantity);
  const refund = Number(returnAmount);
  if (isNaN(qty) || qty <= 0) {
    return res.status(400).json({ message: 'Quantity must be a positive number' });
  }
  if (isNaN(refund) || refund < 0) {
    return res.status(400).json({ message: 'Return amount must be a valid number' });
  }

  try {
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const { itemsPerPet, unitPrice } = product;

    // Always normalize to units — the atomic quantity — regardless of returnType
    const units = returnType === 'unit' ? Math.round(qty) : Math.round(qty * itemsPerPet);
    const pets = Number((units / itemsPerPet).toFixed(4));

    if (units > product.unitStock) {
      return res.status(400).json({ message: 'Insufficient stock to return' });
    }

    const stockCostPrice = unitPrice * units; // what these units cost you originally
    const profit = refund - stockCostPrice;    // gain/loss on the return itself

    product.unitStock -= units;
    product.petStock = Number((product.unitStock / itemsPerPet).toFixed(4));
    if (product.unitStock < 0) product.unitStock = 0;
    if (product.petStock < 0) product.petStock = 0;
    await product.save();

    // Ledger entry so it shows up in stock history like any other movement
    const stockEntry = await StockIn.create({
      product: productId,
      type: 'out',
      petStock: pets,
      unitStock: units,
      itemsPerPet,
      unitPrice,
      petPrice: product.petPrice,
      stockSellingPrice: refund,   // what actually came back in
      stockCostPrice,
      profit,
      note: note ? `Return: ${note}` : 'Product return'
    });

    const returnEntry = await ProductReturn.create({
      product: productId,
      quantity: qty,
      returnType,
      purchasePrice: unitPrice,
      returnAmount: refund,
      reason,
      note,
      returnedBy: req.user._id,
    });

    await Expense.create({
      title: `Product Return - ${product.name} (${product.variantName})`,
      amount: refund,
      description: `Returned ${units} unit(s) of ${product.name} (${product.variantName})`,
      expenseDate: new Date(),
      addedBy: req.user._id,
      paymentMethod: 'Cash',
      type: 'Cash In'
    });

    res.status(201).json({
      success: true,
      message: 'Product returned successfully',
      returnEntry,
      stockEntry,
      product
    });
  } catch (error) {
    console.error('Error returning product:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});