const mongoose = require("mongoose")
const {Schema} = mongoose




const  orderSchema = new Schema({
    orderId: {
        type: String,
        unique: true,
        required: true
      }
      ,
    userId:{
        type:Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    orderedItems:[{
        product:{
            type:Schema.Types.ObjectId,
            ref:"Product",
            required:true
        },
        quantity:{
             type:Number,
             required :true
        },
        price:{
            type:Number,
            default:0
        },
        name:{
            type:String,
            required:true
        },
        sku:{
            type:String,
            required:true
        },

        status:{
            type:String,
            required:true,
            enum:['Pending','Shipped','Delivered','Cancelled','Return Request','Returned','Return Rejected','Cancel requested','Processing','Payment failed']
        },
        cancellationReason:{
            type:String,
            required:false,
        },
        returnReason:{
            type:String,
            required:false,
        },
        returnRejectReeason:{
            type:String,
            required:false,
        }
    }],
    totalPrice:{
        type:Number,
        required:true
    },

    orderType: {
        type: String,
        required: true,
        enum: ['razorPay', 'cod', 'wallet']
      },
    
      couponDiscount: {
        type: Number,
        default: 0
      },
      offerDiscount: {
        type: Number,
        default: 0
      },
      finalAmount: {
        type: Number,
        required: true
      },
      
      paymentAmount: {
        type: Number,
        required: true
      },
      
    address:{
        addressType:{
            type:String,
            required  :true,      
        },
        name:{
            type :String,
            required:true,
        },
        city:{
            type:String,
            required:true,
        },
        landMark:{
            type:String,
            required:true

        } ,
        state:{
            type:String,
            required:true
        },
        pincode:{
            type:Number,
            required:true,
        },
        phone:{
            type:String,
            required:true,

        },
        altPhone:{
            type:String,
            required:true
        }
    },
    invoiceDate:{
        type:Date,

    },
    status:{
        type:String,
        required:true,
        enum:['Pending','Processing','Shipped','Delivered','Cancelled','Return Request','Returned','Return Rejected','Cancel requested','Payment failed']
    },
    createdOn:{
        type:Date,
        default:Date.now,
        required:true
    },
    couponApplied:{
        type:Boolean,
        default:false
    },
   
    cancellationReason:{
        type:String,
        required:false,
    },
    couponCode:{
        type:String,
        required:false
    },
    razorpayOrderId:{
        type:String,
        required:false,
    }


})

const Order = mongoose.model("Order",orderSchema)
module.exports =  Order