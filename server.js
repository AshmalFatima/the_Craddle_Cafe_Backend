require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();

app.use(cors());
app.use(express.json());

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

// Routes
app.get("/", (req, res) => {
  res.send("Server is running...");
});

app.use("/api/users", require("./routes/userRoute"));
app.use("/api/products", require("./routes/productRoute"));
app.use("/api/categories", require("./routes/categoryRoute"));
app.use("/api/expenses", require("./routes/expenseRoute"));
app.use("/api/stock", require("./routes/stockInRoute"));
app.use("/api/dues", require("./routes/dueRoute"));
app.use("/api/customers", require("./routes/customerRoute"));
app.use("/api/dashboard", require("./routes/dashboardRoute"));
app.use("/api/returns", require("./routes/productReturnRoute"));
// Local development
if (require.main === module) {
  connectDB()
    .then(() => {
      const PORT = process.env.PORT || 5000;

      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    })
    .catch((error) => {
      console.error("MongoDB connection error:", error);
      process.exit(1);
    });
}

// Export for Vercel
module.exports = async (req, res) => {
  try {
    await connectDB();
    return app(req, res);
  } catch (error) {
    console.error("MongoDB connection error:", error);

    return res.status(500).json({
      message: "Database connection failed",
      error: error.message,
    });
  }
};