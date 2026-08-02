const mongoose = require("mongoose");

const dailyClosingSchema = new mongoose.Schema(
{
    date:{
        type:Date,
        required:true,
        unique:true
    },

    products:[
        {
            product:{
                type:mongoose.Schema.Types.ObjectId,
                ref:"Product"
            },

            openingStock:Number,

            closingStock:Number,

            soldQuantity:Number,

            salesAmount:Number,

            costAmount:Number,

            profit:Number
        }
    ],

    totalSales:{
        type:Number,
        default:0
    },

    totalCost:{
        type:Number,
        default:0
    },

    grossProfit:{
        type:Number,
        default:0
    },

    closedBy:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User"
    }
},
{timestamps:true});

module.exports = mongoose.model("DailyClosing",dailyClosingSchema);