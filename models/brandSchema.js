    const mongoose=require('mongoose')
    const {Schema}=mongoose

    const brandSchema=new Schema({
        brandName:{
            type:String,
            required:true,
        },
        brandImage:{
            type:String,
        },
        productOffer:{
            type:Number,
            default:0
        },
        isBlocked:{
            type:Boolean,
            default:false
        },
        createdAt:{
            type:Date,
            default:Date.now
        }, 
        
    },
    {timestamps: true} 
)

    const Brand=mongoose.model('Brand',brandSchema)
    module.exports=Brand