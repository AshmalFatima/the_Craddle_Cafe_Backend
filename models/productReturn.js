
const mongoose = require("mongoose");

const productReturnSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    // Quantity being returned
    quantity: {
      type: Number,
      required: true,
      min: 0.01,
    },

    // Return as unit or pet/carton
    returnType: {
      type: String,
      enum: ["unit", "pet"],
      required: true,
    },

    // Price at which admin purchased the product
    purchasePrice: {
      type: Number,
      required: true,
      min: 0,
    },

    // Total amount received/refunded from supplier
    returnAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    // Reason for returning
    reason: {
      type: String,
      required: true,
      trim: true,
    },

    // Admin/user who processed the return
    returnedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Optional note
    note: {
      type: String,
      trim: true,
    },

    returnDate: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ProductReturn", productReturnSchema);

