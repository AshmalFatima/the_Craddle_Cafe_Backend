const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const authMiddleware = require('../authMiddleware');
const User = require('../models/User');

router.post("/", authMiddleware, async (req, res) => {
    const { name, amount, description } = req.body;

    if (
        !name?.trim() ||
        amount === undefined ||
        amount === null 
    ) {
        return res.status(400).json({
            message: "Please provide name and amount for the expense",
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
            title: name.trim(),
            amount: Number(amount),
            description: description?.trim() || "",
            addedBy: req.user.userId,
        });

        await newExpense.save();

        res.status(201).json({
            message: "Expense added successfully",
            success: true,
        });
    } catch (err) {
        console.error("Error adding expense:", err);
        res.status(500).json({
            message: "Server error",
        });
    }
});


router.get("/total", authMiddleware, async (req, res) => {
    const { startDate, endDate, username } = req.query;

    const match = {};

    // Salesman: only their own expenses
    if (req.user.role === "salesman") {
        match.addedBy = new mongoose.Types.ObjectId(req.user.userId);
        if (username) {
            return res.status(403).json({
                message: "You are not authorized to filter by username"
            });
        }
    }

    // Date range filter
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
        // Admin can filter by username
        if (req.user.role === "admin" && username) {
            const user = await User.findOne({
                name: { $regex: username, $options: "i" }
            });

            if (!user) {
                return res.json({ total: 0 });
            }

            match.addedBy = user._id;
        }

        const totalExpenses = await Expense.aggregate([
            { $match: match },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$amount" }
                }
            }
        ]);

        res.json({
            total: totalExpenses[0]?.total || 0
        });

    } catch (err) {
        console.error("Error calculating total expenses:", err);
        res.status(500).json({
            message: "Server error"
        });
    }
});


router.get("/search", authMiddleware, async (req, res) => {
    const { name, minAmount, maxAmount, date, username } = req.query;

    const filter = {};

    
    // Salesman can search only their own expenses
    if (req.user.role === "salesman") {
        filter.addedBy = req.user.userId;
        if (username) {
            return res.status(403).json({
                message: "You are not authorized to filter by username"
            });
        }
    }

    if (name) {
        filter.title = { $regex: name, $options: "i" };
    }

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
            .populate("addedBy", "name contact role");

        // Admin can filter by username
        if (req.user.role === "admin" && username) {
            expenses = expenses.filter(expense =>
                expense.addedBy.name
                    .toLowerCase()
                    .includes(username.toLowerCase())
            );
        }

        if (expenses.length === 0) {
            return res.status(404).json({
                message: "No expenses found matching the criteria"
            });
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
        let expenses;

        // Admin can see all expenses
        if (req.user.role === "admin") {
            expenses = await Expense.find()
                .populate("addedBy", "name contact role");
        }
        // Salesman can see only their own expenses
        else {
            expenses = await Expense.find({
                addedBy: req.user.userId
            }).populate("addedBy", "name contact role");
        }
        if (!expenses || expenses.length === 0) {
            return res.status(404).json({
                message: "No expenses found"
            });
        }

        res.json(expenses);

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
            .populate("addedBy", "name contact role");

        if (!expense) {
            return res.status(404).json({
                message: "Expense not found"
            });
        }

        // Salesman can only view their own expense
        if (
            req.user.role === "salesman" &&
            expense.addedBy._id.toString() !== req.user.userId
        ) {
            return res.status(403).json({
                message: "You are not authorized to view this expense"
            });
        }

        res.json(expense);

    } catch (err) {
        console.error("Error fetching expense:", err);
        res.status(500).json({
            message: "Server error"
        });
    }
});


router.put("/:id", authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { name, amount, description } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid expense ID" });
    }
    if (!name || !amount  || !name.trim() ) {
        return res.status(400).json({ message: 'Please provide all required fields' });
    }
    if (Number(amount) <= 0) {
        return res.status(400).json({ message: 'Amount must be greater than 0' });
    }
    if (amount && isNaN(amount)) {
        return res.status(400).json({ message: 'Amount must be a number' });
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

        expense.title = name.trim();
        expense.amount = Number(amount);
        expense.description = description?.trim() || "";
        await expense.save();
        res.json({ message: "Expense updated successfully", success: true });
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
        if ( req.user.role === "salesman" &&
            expense.addedBy.toString() !== req.user.userId) {
            return res.status(403).json({
                message: "You are not authorized to delete this expense"
            });
        }
        await expense.deleteOne();
        res.json({ message: "Expense deleted successfully", success: true });
    } catch (err) {
        console.error('Error deleting expense:', err);
        res.status(500).json({ message: 'Server error' });
    }
});











module.exports = router;

