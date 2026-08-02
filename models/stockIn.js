const mongoose = require("mongoose");

const stockInSchema = new mongoose.Schema(
{
    product:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Product",
        required:true
    },

    quantity:{
        type:Number,
        required:true
    },
   
    note:{
        type:String,
        default:""
    },


    purchasePrice:{
        type:Number,
        default:0
    },


    addedBy:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User"
    },

    addedAt:{
        type:Date,
        default:Date.now
    }
},
{timestamps:true});

module.exports = mongoose.model("StockIn",stockInSchema);