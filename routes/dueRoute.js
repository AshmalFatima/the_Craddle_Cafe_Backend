const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Dues = require('../models/dues');
const Customer = require('../models/customer');
const Product = require('../models/product');
const authMiddleware = require('../authMiddleWare');


router.get('/', authMiddleware, async (req, res) => {
  try {
    const { search, status, startDate, endDate, page = 1, limit = 20 } = req.query;

    let customerFilter = {};
    if (search) {
      const matchingCustomers = await Customer.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { contact: { $regex: search, $options: 'i' } },
        ],
      }).select('_id');
      customerFilter = { customer: { $in: matchingCustomers.map((c) => c._id) } };
    }

    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    let statusFilter = {};
    if (status === 'paid') statusFilter = { remaining: 0 };
    else if (status === 'unpaid') statusFilter = { paid: 0 };
    else if (status === 'partial') statusFilter = { paid: { $gt: 0 }, remaining: { $gt: 0 } };

    const query = { ...customerFilter, ...dateFilter, ...statusFilter };

    const dues = await Dues.find(query)
      .populate('customer', 'name contact')
      .populate('products.product', 'name variant')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

   

    const totalCount = await Dues.countDocuments(query);

    const summaryAgg = await Dues.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$totalAmount' },
          totalPaid: { $sum: '$paid' },
          totalRemaining: { $sum: '$remaining' },
        },
      },
    ]);

    const summary = summaryAgg[0]
      ? {
          totalAmount: summaryAgg[0].totalAmount,
          totalPaid: summaryAgg[0].totalPaid,
          totalRemaining: summaryAgg[0].totalRemaining,
        }
      : { totalAmount: 0, totalPaid: 0, totalRemaining: 0 };

    res.json({
      dues,
      totalCount,
      page: Number(page),
      totalPages: Math.ceil(totalCount / Number(limit)) || 1,
      summary,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});



router.get('/:id',authMiddleware, async (req, res) => {
  try {
    const due = await Dues.findById(req.params.id)
      .populate('customer', 'name contact')
      .populate('products.product', 'name variant')
      .populate('addedBy', 'name');

    if (!due) return res.status(404).json({ message: 'Due not found' });
    res.json(due);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * POST /api/dues
 * Create a new due. Body: { customer, products: [{product, quantity, price}], paid }
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { customer, products, paid = 0 } = req.body;

    if (!customer) return res.status(400).json({ message: 'Customer is required' });
    if (!products || !products.length) {
      return res.status(400).json({ message: 'At least one product is required' });
    }

    const productsWithTotal = products.map((p) => ({
      product: p.product,
      quantity: p.quantity,
      price: p.price,
      total: p.quantity * p.price,
    }));

    const totalAmount = productsWithTotal.reduce((sum, p) => sum + p.total, 0);
    const remaining = totalAmount - paid;

    if (remaining < 0) {
      return res.status(400).json({ message: 'Paid amount cannot exceed total amount' });
    }

    const due = await Dues.create({
      customer,
      products: productsWithTotal,
      totalAmount,
      paid,
      remaining,
      addedBy: req.user?._id, // requires auth middleware to populate req.user
    });

    const populated = await due.populate([
      { path: 'customer', select: 'name contact' },
      { path: 'products.product', select: 'name variant' },
    ]);

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * PUT /api/dues/:id/payment
 * Record a payment against an existing due. Body: { amount }
 */
router.put('/:id/payment', authMiddleware, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Enter a valid payment amount' });
    }

    const due = await Dues.findById(req.params.id);
    if (!due) return res.status(404).json({ message: 'Due not found' });

    if (amount > due.remaining) {
      return res.status(400).json({ message: 'Payment exceeds remaining amount' });
    }

    due.paid += amount;
    due.remaining -= amount;
    await due.save();

    const populated = await due.populate([
      { path: 'customer', select: 'name contact' },
      { path: 'products.product', select: 'name variant' },
    ]);

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * PUT /api/dues/:id
 * Edit a due's products / paid amount, recalculates totals.
 */
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { products, paid } = req.body;
    const due = await Dues.findById(req.params.id);
    if (!due) return res.status(404).json({ message: 'Due not found' });

    if (products) {
      const productsWithTotal = products.map((p) => ({
        product: p.product,
        quantity: p.quantity,
        price: p.price,
        total: p.quantity * p.price,
      }));
      due.products = productsWithTotal;
      due.totalAmount = productsWithTotal.reduce((sum, p) => sum + p.total, 0);
    }

    if (paid !== undefined) due.paid = paid;
    due.remaining = due.totalAmount - due.paid;

    if (due.remaining < 0) {
      return res.status(400).json({ message: 'Paid amount cannot exceed total amount' });
    }

    await due.save();

    const populated = await due.populate([
      { path: 'customer', select: 'name contact' },
      { path: 'products.product', select: 'name variant' },
    ]);

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * DELETE /api/dues/:id
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const due = await Dues.findByIdAndDelete(req.params.id);
    if (!due) return res.status(404).json({ message: 'Due not found' });
    res.json({ message: 'Due deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

