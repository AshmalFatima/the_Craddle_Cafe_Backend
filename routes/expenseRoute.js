const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Expense = require('../models/expense');
const authMiddleware = require('../authMiddleWare');
const Product = require("../models/product");
const User = require("../models/user");
const VALID_TYPES = ["Cash In", "Cash Out", "Reinvestment"];



router.post("/", authMiddleware, async (req, res) => {
    const { name, amount, description, type , paymentMethod} = req.body;

    // name/title is now optional — falls back to the type (e.g. "Cash In")
    if (
        amount === undefined ||
        amount === null ||
        !type?.trim()
    ) {
        return res.status(400).json({
            message: "Please provide amount and type for the expense",
        });
    }

    if (!VALID_TYPES.includes(type.trim())) {
        return res.status(400).json({
            message: "Type must be either 'Cash In' or 'Cash Out'",
        });
    }

    if (isNaN(amount)) {
        return res.status(400).json({
            message: "Amount must be a number",
        });
    }

    if (Number(amount) <= 0) {
        return res.status(400).json({
            message: "Amount must be greater than 0",
        });
    }

    try {
        const newExpense = new Expense({
            title: name?.trim() || type.trim(),
            amount: Number(amount),
            description: description?.trim() || "",
            type: type.trim(),
            paymentMethod: paymentMethod.trim(),
            addedBy: req.user.userId,
        });

        await newExpense.save();

        res.status(201).json({
            message: "Expense added successfully",
            success: true,
            expense: newExpense,
        });
    } catch (err) {
        console.error("Error adding expense:", err);
        res.status(500).json({
            message: "Server error",
        });
    }
});


// Returns overall total, plus a breakdown of Cash In / Cash Out totals.
// Optional startDate/endDate query params scope the totals to a date range.
router.get("/total", authMiddleware, async (req, res) => {
    const { startDate, endDate } = req.query;

    const match = {};

    if (startDate || endDate) {
        if (!startDate || !endDate) {
            return res.status(400).json({
                message: "Please provide both startDate and endDate"
            });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({
                message: "Invalid date format"
            });
        }

        if (start > end) {
            return res.status(400).json({
                message: "startDate cannot be greater than endDate"
            });
        }

        end.setHours(23, 59, 59, 999);

        match.expenseDate = {
            $gte: start,
            $lte: end
        };
    }

    try {
        const totalsByType = await Expense.aggregate([
            { $match: match },
            {
                $group: {
                    _id: "$type",
                    total: { $sum: "$amount" },
                    count: { $sum: 1 }
                }
            }
        ]);

        const result = {
            cashIn: 0,
            cashOut: 0,
            cashInCount: 0,
            cashOutCount: 0,
        };

        totalsByType.forEach((t) => {
            if (t._id === "Cash In") {
                result.cashIn = t.total;
                result.cashInCount = t.count;
            } else if (t._id === "Cash Out") {
                result.cashOut = t.total;
                result.cashOutCount = t.count;
            }
        });

        result.balance = result.cashIn - result.cashOut;
        result.total = result.cashIn + result.cashOut;

        res.json(result);

    } catch (err) {
        console.error("Error calculating total expenses:", err);
        res.status(500).json({
            message: "Server error"
        });
    }
});


router.get("/search", authMiddleware, async (req, res) => {
    const {
        name,
        description,
        minAmount,
        maxAmount,
        date,
        startDate,
        endDate,
        username,
        type,
        
    } = req.query;

    const filter = {};

    if (name) {
        filter.title = { $regex: name, $options: "i" };
    }

    if (description) {
        filter.description = { $regex: description, $options: "i" };
    }

    if (type) {
        if (!VALID_TYPES.includes(type)) {
            return res.status(400).json({
                message: "Type must be either 'Cash In' or 'Cash Out'"
            });
        }
        filter.type = type;
    }

    // Single-day filter (kept for backwards compatibility)
    if (date) {
        const parsedDate = new Date(date);

        if (isNaN(parsedDate.getTime())) {
            return res.status(400).json({
                message: "Invalid date format"
            });
        }

        const startOfDay = new Date(parsedDate);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(parsedDate);
        endOfDay.setHours(23, 59, 59, 999);

        filter.expenseDate = {
            $gte: startOfDay,
            $lte: endOfDay
        };
    }

    // Date range filter (from / to)
    if (startDate || endDate) {
        if (!startDate || !endDate) {
            return res.status(400).json({
                message: "Please provide both startDate and endDate"
            });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({
                message: "Invalid date format"
            });
        }

        if (start > end) {
            return res.status(400).json({
                message: "startDate cannot be greater than endDate"
            });
        }

        end.setHours(23, 59, 59, 999);

        filter.expenseDate = {
            $gte: start,
            $lte: end
        };
    }

    if (minAmount || maxAmount) {

        if (minAmount && isNaN(minAmount)) {
            return res.status(400).json({
                message: "Minimum amount must be a number"
            });
        }

        if (maxAmount && isNaN(maxAmount)) {
            return res.status(400).json({
                message: "Maximum amount must be a number"
            });
        }

        if (minAmount && Number(minAmount) <= 0) {
            return res.status(400).json({
                message: "Minimum amount must be greater than 0"
            });
        }

        if (maxAmount && Number(maxAmount) <= 0) {
            return res.status(400).json({
                message: "Maximum amount must be greater than 0"
            });
        }

        if (
            minAmount &&
            maxAmount &&
            Number(minAmount) > Number(maxAmount)
        ) {
            return res.status(400).json({
                message: "Minimum amount cannot be greater than maximum amount"
            });
        }

        filter.amount = {};

        if (minAmount) {
            filter.amount.$gte = Number(minAmount);
        }

        if (maxAmount) {
            filter.amount.$lte = Number(maxAmount);
        }
    }

    try {

        let expenses = await Expense.find(filter)
            .populate("addedBy", "name  role")
            .sort({ expenseDate: -1 });


        if (username) {
            expenses = expenses.filter(expense =>
                expense.addedBy?.name
                    ?.toLowerCase()
                    .includes(username.toLowerCase())
            );
        }

        res.json(expenses);

    } catch (err) {
        console.error("Error searching expenses:", err);
        res.status(500).json({
            message: "Server error"
        });
    }
});


router.get("/", authMiddleware, async (req, res) => {
    try {

        const expenses = await Expense.find()
            .populate("addedBy", "name  role")
            .sort({ expenseDate: -1 });

        res.status(200).json(expenses);

    } catch (err) {
        console.error("Error fetching expenses:", err);
        res.status(500).json({
            message: "Server error"
        });
    }
});



router.get("/:id", authMiddleware, async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            message: "Invalid expense ID"
        });
    }

    try {
        const expense = await Expense.findById(id)
            .populate("addedBy", "name  role");

        if (!expense) {
            return res.status(404).json({
                message: "Expense not found"
            });
        }

        res.status(200).json(expense);

    } catch (err) {
        console.error("Error fetching expense:", err);
        res.status(500).json({
            message: "Server error"
        });
    }
});


router.put("/:id", authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { name, amount, description, type , paymentMethod} = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid expense ID" });
    }
    if (amount === undefined || amount === null || !type || !type.trim()) {
        return res.status(400).json({ message: 'Please provide amount and type' });
    }
    if (!VALID_TYPES.includes(type.trim())) {
        return res.status(400).json({ message: "Type must be either 'Cash In' or 'Cash Out'" });
    }
    if (isNaN(amount)) {
        return res.status(400).json({ message: 'Amount must be a number' });
    }
    if (Number(amount) <= 0) {
        return res.status(400).json({ message: 'Amount must be greater than 0' });
    }
    try {
        const expense = await Expense.findById(id);
        if (!expense) {
            return res.status(404).json({ message: "Expense not found" });
        }

        if (expense.addedBy.toString() !== req.user.userId) {
            return res.status(403).json({
                message: "You are not authorized to update this expense"
            });
        }

        expense.title = name?.trim() || type.trim();
        expense.amount = Number(amount);
        expense.description = description?.trim() || "";
        expense.type = type.trim();
        expense.paymentMethod = paymentMethod.trim();
        await expense.save();
        res.json({ message: "Expense updated successfully", success: true, expense });
    } catch (err) {
        console.error('Error updating expense:', err);
        res.status(500).json({ message: 'Server error' });
    }
});



router.delete("/:id", authMiddleware, async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid expense ID" });
    }
    try {
        const expense = await Expense.findById(id);

        if (!expense) {
            return res.status(404).json({ message: "Expense not found" });
        }

        await expense.deleteOne();
        res.status(200).json({ message: "Expense deleted successfully", success: true });
    } catch (err) {
        console.error('Error deleting expense:', err);
        res.status(500).json({ message: 'Server error' });
    }
});



//add cash out expense from all previous products 
router.post("/add-cash-out", authMiddleware, async (req, res) => {
    try {
        const products = await Product.find();  
        for (const product of products) {
            const cashOutExpense = new Expense({
                title: `Cash Out for ${product.name} (${product.variantName})`,
                amount: product.unitPrice * product.unitStock,
                description: `Cash out expense for product ${product.name} (${product.variantName})`,
                type: "Cash Out",
                addedBy: req.user.userId,
            });
            await cashOutExpense.save();
        }   
        res.status(201).json({ message: 'Cash out expenses added successfully', success: true });
    }catch (err) {
        console.error('Error adding cash out expenses:', err);
        res.status(500).json({ message: 'Server error' });
    } 
});

module.exports = router;