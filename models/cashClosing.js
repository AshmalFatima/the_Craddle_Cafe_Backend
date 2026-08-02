const mongoose = require("mongoose");

const cashClosingSchema = new mongoose.Schema(
{
    date:{
        type:Date,
        required:true,
        unique:true
    },

    expectedCash:{
        type:Number,
        default:0
    },

    receivedCash:{
        type:Number,
        default:0
    },

    difference:{
        type:Number,
        default:0
    },

    note:{
        type:String,
        default:""
    },

    verifiedBy:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User"
    }
},
{timestamps:true});

module.exports = mongoose.model("CashClosing",cashClosingSchema);