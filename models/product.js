const mongoose = require("mongoose");


const productSchema = new mongoose.Schema(
{
    category:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Category",
        required:true
    },

    name:{
        type:String,
        required:true,
        trim:true
    },

    variantName:{
        type:String,
        required:true
    },  
  
    costPrice:{
        type:Number,
        required:true
    } , 
    sku:{
        type:String,
        required:true,
        unique:true
    } , 
    sellingPrice:{
        type:Number,
        required:true
    } ,

    stock:{
        type:Number,
        reuired:true,     
    },
 
},
{timestamps:true});


module.exports = mongoose.model("Product",productSchema);