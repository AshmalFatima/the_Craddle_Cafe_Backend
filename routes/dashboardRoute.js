const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Product = require('../models/product');
const StockIn = require('../models/stockIn');
const Expense = require('../models/expense');
const Dues = require('../models/dues');
const authMiddleware = require('../authMiddleWare');

function buildDateFilter(dateField, startDate, endDate) {
  const filter = {};
  if (startDate) filter[dateField] = { $gte: new Date(startDate) };
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    filter[dateField] = filter[dateField] || {};
    filter[dateField].$lte = end;
  }
  return Object.keys(filter).length ? filter[dateField] : null;
}

router.get('/', authMiddleware, async (req, res) => {
  const { startDate, endDate } = req.query;

  try {
    // Products summary (current stock snapshot)
    const products = await Product.find().populate('category', 'name');

    const productsSummary = products.map((p) => {
      const costValue = (p.unitPrice || 0) * (p.unitStock || 0);
      const sellingValue = (p.sellingPrice || 0) * (p.unitStock || 0);
      const profitValue = sellingValue - costValue;
      return {
        _id: p._id,
        name: p.name,
        variantName: p.variantName,
        category: p.category || null,
        unitStock: p.unitStock || 0,
        petStock: p.petStock || 0,
        unitPrice: p.unitPrice || 0,
        sellingPrice: p.sellingPrice || 0,
        costValue,
        sellingValue,
        profitValue,
      };
    });

    const totals = productsSummary.reduce(
      (acc, cur) => {
        acc.totalUnits += cur.unitStock;
        acc.totalCost += cur.costValue;
        acc.totalSelling += cur.sellingValue;
        acc.totalProfit += cur.profitValue;
        return acc;
      },
      { totalUnits: 0, totalCost: 0, totalSelling: 0, totalProfit: 0 }
    );

    // Movements in the date range (if any)
    const movementQuery = {};
    const createdAtFilter = buildDateFilter('createdAt', startDate, endDate);
    if (createdAtFilter) movementQuery.createdAt = createdAtFilter;

    const movements = await StockIn.find(movementQuery);

    const movementTotals = movements.reduce(
      (acc, m) => {
        if (m.type === 'in') {
          acc.unitsIn += m.unitStock || 0;
          acc.costIn += m.stockCostPrice || 0;
          acc.sellingIn += m.stockSellingPrice || 0;
          acc.profitIn += m.profit || 0;
        } else {
          acc.unitsOut += m.unitStock || 0;
          acc.costOut += m.stockCostPrice || 0;
          acc.sellingOut += m.stockSellingPrice || 0;
          acc.profitOut += m.profit || 0;
        }
        return acc;
      },
      {
        unitsIn: 0,
        costIn: 0,
        sellingIn: 0,
        profitIn: 0,
        unitsOut: 0,
        costOut: 0,
        sellingOut: 0,
        profitOut: 0,
      }
    );

    // Expenses in date range
    const expenseQuery = {};
    const expenseDateFilter = buildDateFilter('expenseDate', startDate, endDate);
    if (expenseDateFilter) expenseQuery.expenseDate = expenseDateFilter;
    const expenses = await Expense.find(expenseQuery).sort({ expenseDate: -1 });

    // IMPORTANT: bucket by exact type. The previous version used
    // `if (type === 'Cash Out') totalOut += ...; else totalIn += ...;`
    // which silently folded "Reinvestment" and "Personal" entries into
    // totalIn, inflating the Cash In figure by however much had been
    // reinvested or spent personally. Each type now has its own bucket.
    const expenseTotals = expenses.reduce(
      (acc, e) => {
        if (e.type === 'Cash Out') acc.totalOut += e.amount || 0;
        else if (e.type === 'Cash In') acc.totalIn += e.amount || 0;
        else if (e.type === 'Reinvestment') acc.totalReinvest += e.amount || 0;
        else if (e.type === 'Personal') acc.totalPersonal += e.amount || 0;
        return acc;
      },
      { totalIn: 0, totalOut: 0, totalReinvest: 0, totalPersonal: 0 }
    );

    // Cash actually still on hand: money in, minus money out, minus
    // whatever was recycled into stock or spent personally.
    expenseTotals.netCash =
      expenseTotals.totalIn -
      expenseTotals.totalOut -
      expenseTotals.totalReinvest -
      expenseTotals.totalPersonal;

    // Dues: overall remaining and those in date range
    const duesQuery = {};
    const duesDateFilter = buildDateFilter('createdAt', startDate, endDate);
    if (duesDateFilter) duesQuery.createdAt = duesDateFilter;
    const duesList = await Dues.find(duesQuery).populate('customer', 'name');

    const duesTotals = duesList.reduce(
      (acc, d) => {
        acc.count += 1;
        acc.totalAmount += d.totalAmount || 0;
        acc.paid += d.paid || 0;
        acc.remaining += d.remaining || 0;
        return acc;
      },
      { count: 0, totalAmount: 0, paid: 0, remaining: 0 }
    );

    // Also provide global remaining dues (not date-limited) for quick reference
    const globalRemainingAgg = await Dues.aggregate([
      { $group: { _id: null, totalRemaining: { $sum: '$remaining' } } },
    ]);
    const globalRemaining = (globalRemainingAgg[0] && globalRemainingAgg[0].totalRemaining) || 0;

    res.json({
      productsSummary,
      totals,
      movementTotals,
      expenses,
      expenseTotals,
      duesList,
      duesTotals,
      globalRemaining,
    });
  } catch (err) {
    console.error('Error building dashboard:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;