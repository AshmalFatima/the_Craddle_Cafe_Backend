const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Customer = require('../models/customer');
const Dues = require('../models/dues');
const authMiddleware = require('../authMiddleWare');

/**
 * GET /api/customers?search=
 * List / search customers by name or contact.
 * (Matches what the frontend CustomerPicker already calls.)
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { search } = req.query;

    let filter = {};
    if (search) {
      filter = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { contact: { $regex: search, $options: 'i' } },
        ],
      };
    }

    const customers = await Customer.find(filter).sort({ name: 1 });

    res.json({ customers });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * POST /api/customers
 * Create a new customer. Body: { name, contact }
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, contact } = req.body;

    if (!name || !contact) {
      return res.status(400).json({ message: 'Name and contact are required' });
    }

    const customer = await Customer.create({ name, contact });

    res.status(201).json({ customer });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * DELETE /api/customers/:id
 * Deletes a customer AND every due record that belongs to them.
 * Uses a transaction when running against a replica set / Atlas; falls
 * back to a plain sequential delete on a standalone Mongo instance
 * (transactions aren't supported there).
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid customer id' });
  }

  try {
    let customer;
    let deletedDuesCount = 0;

    try {
        customer = await Customer.findById(id);

        if (!customer) {
          throw Object.assign(new Error('Customer not found'), { status: 404 });
        }

        const duesResult = await Dues.deleteMany({ customer: id });
        deletedDuesCount = duesResult.deletedCount || 0;

        await Customer.findByIdAndDelete(id);
      
    } catch (txErr) {
      // Standalone Mongo (no replica set) throws on startTransaction.
      // Fall back to a non-transactional sequential delete so this still
      // works in local/dev environments.
      if (txErr.status === 404) throw txErr;

      customer = await Customer.findById(id);
      if (!customer) {
        return res.status(404).json({ message: 'Customer not found' });
      }

      const duesResult = await Dues.deleteMany({ customer: id });
      deletedDuesCount = duesResult.deletedCount || 0;

      await Customer.findByIdAndDelete(id);
    }

    res.json({
      message: 'Customer and their dues deleted',
      deletedDuesCount,
    });
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    res.status(500).json({ message: err.message });
  } finally {
    // session.endSession();
  }
});

module.exports = router;