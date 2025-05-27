const mongoose=require('mongoose')

const {Schema}=mongoose;

const couponSchema=new mongoose.Schema({
    name:{
        type:String,
        required:true,
        unique:true
    },
    createdOn:{
        type:Date,
        default:Date.now,
        required:true
    },
    expireOn:{
        type:Date,
        required:true,
    },
    offerPrice:{
        type:Number,
        required:true
    },
    discountType:{
        type:String,
        enum: ['percentage', 'fixed'],
        default: 'percentage'
    },
    minimumPrice:{
        type:Number,
        required:true
    },
    maxUses:{
        type:Number,
        default: null
    },
    usedCount:{
        type:Number,
        default: 0
    },
    description:{
        type:String,
        default: ''
    },
    isList:{
        type:Boolean,
        default:true
    },
    userId:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User',
    }]
}, {
    timestamps: true
});

const Coupon=mongoose.model('Coupon',couponSchema)

module.exports=Coupon
