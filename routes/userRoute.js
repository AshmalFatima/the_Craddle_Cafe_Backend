const express = require('express');
const router = express.Router();
const User = require("../models/user");
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../authMiddleWare');



// User registration
router.post('/register', async (req, res) => {

    const { name, contact, password , role } = req.body;

    if(!name?.trim() || !contact ?.trim() || !password?.trim()) {
        return res.status(400).json({ message: 'Please provide name, contact and password' });
    }
   if(!/^[a-zA-Z\s]+$/.test(name)) {
        return res.status(400).json({ message: 'Name should not contain numbers or special characters' });
    }
    if(password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }
    if (!/^\d{11}$/.test(contact)) {
        return res.status(400).json({ message: 'Please enter a valid 11-digit contact number' });
    }
    try {

        const existingUser = await User.findOne({ contact });

        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }   

        const hashedPassword = await bcrypt.hash(password, 10);
        //if role is salesman then set role to salesman otherwise set role to admin
        const userRole = role?.trim().toLowerCase() === 'salesman' ? 'salesman' : 'admin';
        const newUser = new User({ name, contact, password: hashedPassword, role: userRole });

        await newUser.save();

        res.status(201).json({ message: 'User registered successfully', success: true });


    } catch (err) {
        console.error('Error registering user:', err);
        res.status(500).json({ message: 'Server error' });
    }   
});

router.get('/', async (req, res) => {
    try {
        const users = await User.find({}, '-password'); // Exclude password field   
        res.json(users);
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// User login
router.post('/login', async (req, res) => {

    const { contact, password } = req.body;       

    if (!contact || !password) {
        return res.status(400).json({ message: 'Please provide contact and password' });
    }
    try {
        const user = await User.findOne({ contact }); 

        if (!user) {    
            return res.status(400).json({ message: 'Invalid credentials' });
        }  

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ message: 'Incorrect password' });
        } 

        const token = jwt.sign({ userId: user._id , role: user.role }, process.env.JWT_SECRET, { expiresIn: '4h' });

        res.json({ user: {  name: user.name, contact: user.contact, role: user.role }, token });

    } catch (err) {
    console.error(err);
    res.status(500).json({
        message: err.message,
    });
}
});





    
module.exports=router;