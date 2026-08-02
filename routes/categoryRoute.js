const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Category = require('../models/Category');

router.post('/', async (req, res) => {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ message: 'Please provide a name for the category' });
    }
    try {
        const existingCategory = await Category.findOne({
            name: {
                $regex: `^${name.trim()}$`,
                $options: "i"
            },
        });
        if (existingCategory) {
            return res.status(400).json({ message: 'Category already exists' });
        }
        const newCategory = new Category({ name: name.trim(), description: description?.trim() || "" });
        await newCategory.save();
        res.status(201).json({ message: 'Category added successfully', success: true });
    } catch (err) {
        console.error('Error adding category:', err);
        res.status(500).json({ message: 'Server error' });
    }
});


router.get('/', async (req, res) => {
    try {
        const categories = await Category.find();
        res.json(categories);
    } catch (err) {
        console.error('Error fetching categories:', err);
        res.status(500).json({ message: 'Server error' });
    }
});


router.get("/:id", async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid category ID" });
    }
    try {
        const category = await Category.findById(id);
        if (!category) {
            return res.status(404).json({ message: "Category not found" });
        }
        res.json(category);
    } catch (err) {
        console.error('Error fetching category:', err);
        res.status(500).json({ message: 'Server error' });
    }
});



router.get("/name/:name", async (req, res) => {
    const { name } = req.params;
    try {
        const category = await Category.findOne({ name: { $regex: `^${name}$`, $options: 'i' } });
        if (!category) {
            return res.status(404).json({ message: "Category not found" });
        }
        res.json(category);
    }
    catch (err) {
        console.error('Error fetching category by name:', err);
        res.status(500).json({ message: 'Server error' });
    }
});



router.put("/:id", async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid category ID" });
    }
    const { name, description } = req.body;
    try {
        const category = await Category.findById(id);
        if (!category) {
            return res.status(404).json({ message: "Category not found" });
        }
        if (!name || !name.trim()) {
            return res.status(400).json({ message: "Category name is required" });
        }
        const existingCategory = await Category.findOne({
            name: {
                $regex: `^${name.trim()}$`,
                $options: "i"
            },
            _id: { $ne: id }
        });
        if (existingCategory) {
            return res.status(400).json({ message: "Category name already exists" });
        }
        category.name = name.trim();
        category.description = description?.trim() || "";
        await category.save();
        res.json({ message: "Category updated successfully", success: true });
    } catch (err) {
        console.error('Error updating category:', err);
        res.status(500).json({ message: 'Server error' });
    }
});



router.delete("/:id", async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid category ID" });
    }
    try {
        const category = await Category.findByIdAndDelete(id);

        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }

        res.json({ message: 'Category deleted successfully', success: true });
    } catch (err) {
        console.error('Error deleting category:', err);
        res.status(500).json({ message: 'Server error' });
    }
});




router.delete("/name/:name", async (req, res) => {
});








module.exports = router;