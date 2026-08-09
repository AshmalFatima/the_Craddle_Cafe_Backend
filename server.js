
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();

// --------------------------------------------------
// Middleware
// --------------------------------------------------

app.use(cors());
app.use(express.json());

// --------------------------------------------------
// MongoDB connection
// --------------------------------------------------

let isConnected = false;

async function connectDB() {
  if (isConnected && mongoose.connection.readyState === 1) {
    return;
  }

  if (!process.env.MONGO_URL) {
    throw new Error("MONGO_URL is not defined");
  }

  await mongoose.connect(process.env.MONGO_URL);

  isConnected = true;

  console.log("Connected to MongoDB");
}

// Connect to MongoDB before handling API requests
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error("MongoDB connection error:", error);

    return res.status(500).json({
      message: "Database connection failed",
      error: error.message,
    });
  }
});

// --------------------------------------------------
// Routes
// --------------------------------------------------

app.get("/", (req, res) => {
  res.send("Server is running...");
});

app.use("/api/users", require("./routes/userRoute"));
app.use("/api/products", require("./routes/productRoute"));
app.use("/api/categories", require("./routes/categoryRoute"));
app.use("/api/expenses", require("./routes/expenseRoute"));
app.use("/api/stock", require("./routes/stockInRoute"));

// --------------------------------------------------
// Export app for Vercel
// --------------------------------------------------

module.exports = app;
