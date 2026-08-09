const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    variantName: {
      type: String,
      required: true,
      trim: true,
    },

    unitPrice: {
      type: Number,
      required: true,
    },

    petPrice: {
      type: Number,
      required: true,
    },

    sku: {
      type: String,
      required: true,
      unique: true,
    },

    sellingPrice: {
      type: Number,
      required: true,
    },

    // Number of pets/cartons currently in stock. Can be fractional — stocking out by
    // individual units (e.g. 7 bottles from a pet of 6) leaves a partial pet, e.g. 3.83.
    petStock: {
      type: Number,
      required: true,
      default: 0,
    },

    unitStock: {
      type: Number,
      required: true,
      default: 0,
    },

    itemsPerPet: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);