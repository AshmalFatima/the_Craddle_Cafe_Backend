const mongoose = require('mongoose');

const duesSchema = new mongoose.Schema(
    {
        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customer",
            required: true,
        },
       products: [
            {
                // Optional now — catalog items set this, manual/custom
                // items (e.g. a bag of candies with no Product record)
                // leave it unset and rely on `name` instead.
                product: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Product",
                    required: false,
                },
                // Only used for manual/custom items. Catalog items get
                // their name via populate('products.product'), so this
                // stays empty for them.
                name: {
                    type: String,
                    trim: true,
                    default: '',
                },
                quantity: {
                    type: Number,
                    required: true,
                },
                price: {
                    type: Number,
                    required: true,
                },
                total: {
                    type: Number,
                    required: true,
                },
            },
        ],
        totalAmount: {
            type: Number,
            required: true,
        },     
        paid: {
            type: Number,
            default: 0,
        },
        remaining: {
            type: Number,
            required: true,
        },
        addedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        }
    }
);

// Every line must be identifiable one way or the other: either it points
// at a catalog Product, or it carries its own name (manual/custom item).
duesSchema.path('products').validate(function (products) {
    return products.every((p) => p.product || (p.name && p.name.trim()));
}, 'Each product line needs either a catalog product or a name for a custom item.');

module.exports = mongoose.model("Dues", duesSchema);