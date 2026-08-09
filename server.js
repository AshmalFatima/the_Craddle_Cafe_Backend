require("dotenv").config();
const mongoose = require('mongoose');


const express = require('express');
const cors = require('cors');



const app = express();
app.use(cors());
app.use(express.json());


app.use("/api/users", require("./routes/userRoute"));
app.use("/api/products", require("./routes/productRoute"));
app.use("/api/categories", require("./routes/categoryRoute"));
app.use("/api/expenses", require("./routes/expenseRoute"));
app.use("/api/stock", require("./routes/stockInRoute"));
const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGO_URL)
    .then(() => {
        console.log('Connected to MongoDB');
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });



    