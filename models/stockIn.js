const mongoose = require("mongoose");

const stockInSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    // "in" = stock added, "out" = stock removed/sold/damaged etc.
    type: {
      type: String,
      enum: ["in", "out"],
      default: "in",
      required: true,
    },

    petStock: {
      type: Number,
      required: true,
    },

    unitStock: {
      type: Number,
      required: true,
    },

    itemsPerPet: {
      type: Number,
      required: true,
    },

    // snapshot of the product's pricing at the time of this movement
    unitPrice: {
      type: Number,
      required: true,
    },

    petPrice: {
      type: Number,
      required: true,
    },

    stockSellingPrice: {
      type: Number,
      required: true,
    },

    stockCostPrice: {
      type: Number,
      required: true,
    },

    profit: {
      type: Number,
      required: true,
    },

    note: {
      type: String,
      default: "",
    },

    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("StockIn", stockInSchema);