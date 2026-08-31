const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      default: "",
    },
    paymentMethod: {
      type: String,
      enum: ["Cash", "Online"],
      required: true,
    },
    type: {
      type: String,
      enum: ["Cash In", "Cash Out", "Reinvestment"],
      required: true,
    },
    expenseDate: {
      type: Date,
      default: Date.now,
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Expense", expenseSchema);