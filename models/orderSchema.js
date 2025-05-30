    const mongoose=require('mongoose')
    const {Schema}=mongoose

    const {v4:uuidv4}= require('uuid')

    const orderSchema=new Schema({
        orderId:{
            type:String,
            default:()=>uuidv4(),
            unique:true
        },
        orderedItems:[{
            product:{
                type:Schema.Types.ObjectId,
                ref:'Product',
                required:true
            },
            quantity:{
                type:Number,
                required:true,
            },
            price:{
                type:Number,
                default:0
            },

        }],
        totalPrice:{
            type:Number,
            required:true
        },
        finalAmount:{
            type:Number,
            required:true
        },
        address:{
            type:String,
            required:true,
        },
        invoiceDate:{
            type:Date,
        },
        status:{
            type:String,
            required:true,
            enum:['Pending','Processing','Shipped','Delivered','Cancelled','Return Request','Returned', 'Paid']
        },
        createdOn:{
            type:Date,
            default:Date.now,
            required:true,
        },
        coupenApplied:{
            type:Boolean,
            default:false
        },
        couponDiscount: {
            type: Number,
            default: 0
        },
        offerDiscount: {
            type: Number,
            default: 0
        },

        paymentMethod: {
            type: String,
            enum: ['cod', 'razorpay','wallet'],
            required: true
        },
        paymentDetails: {
            razorpayOrderId: String,
            paymentId: String,
            signature: String,
            currency: {
                type: String,
                default: 'INR'
            },
            verified: {
                type: Boolean,
                default: false
            },
            paidAt: Date
        },
        returnDetails: {
            reason: {
                type: String,
                enum: ['damaged', 'wrong-item', 'defective', 'changed-mind', 'other']
            },
            comments: {
                type: String
            },
            requestDate: {
                type: Date
            },
            approvalStatus: {
                type: String,
                enum: ['pending', 'approved', 'rejected'],
                default: 'pending'
            }
        }
    });


    const Order=mongoose.model('Order', orderSchema)

    module.exports=Order
