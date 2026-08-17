const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const authMiddleware = require('../authMiddleWare');
const Customer = require('../models/customer');

router.post('/', authMiddleware, async (req, res) => {
    try {
        const { name, contact } = req.body;
        if (!name || !contact) {
            return res.status(400).json({ message: 'Name and contact are required' });
        }

        if (await Customer.findOne({ contact })) {
            return res.status(400).json({ message: 'Customer with this contact already exists' });
        }
        const newCustomer = new Customer({
            name,
            contact,
            createdBy: req.user._id,
        });
        const savedCustomer = await newCustomer.save();
        res.status(201).json(savedCustomer);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ message: 'Customer with this contact already exists' });
        }
        res.status(500).json({ message: 'Internal server error' });
    }
});   


router.get('/', authMiddleware, async (req, res) => {
    try {
        const customers = await Customer.find().sort({ createdAt: -1 });
        res.json(customers);
    } catch (err) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id);
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }
        res.json(customer);
    } catch (err) {
        res.status(500).json({ message: 'Internal server error' });
    }   
});

router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { name, contact } = req.body;
        if (!name || !contact) {
            return res.status(400).json({ message: 'Name and contact are required' });
        }   

        const customer = await Customer.findById(req.params.id);    
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }
        customer.name = name;
        customer.contact = contact;
        const updatedCustomer = await customer.save();
        res.json(updatedCustomer);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ message: 'Customer with this contact already exists' });
        }
        res.status(500).json({ message: 'Internal server error' });
    }   
});

router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const customer = await Customer.findByIdAndDelete(req.params.id);   
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }
        res.json({ message: 'Customer deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Internal server error' });
    }   
});

module.exports = router;

