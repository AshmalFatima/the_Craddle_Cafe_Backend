const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
{
    name:{
        type:String,
        required:true,
    },

    contact:{
        type:String,
        required:true,
        unique:true ,
        validate: {
            validator: function(v) {
                return /^\d{11}$/.test(v);
            },
            message: 'Please enter a valid 10-digit contact number'
        }
    },

    password:{
        type:String,
        required:true,
        minlength:6
    },

    role:{
        type:String,
        enum:["admin","salesman"],
        default:"admin"
    },

    isActive:{
        type:Boolean,
        default:true
    }
},
{timestamps:true}
);

module.exports =
  mongoose.models.User || mongoose.model("User", userSchema);