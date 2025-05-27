const mongoose = require('mongoose');
const { Schema } = mongoose;
const Counter = require("../models/counterSchema");

// In your user schema
const userSchema = new mongoose.Schema({
    profilePic: {
        type: String,
        default: null
    },
    customerID: { 
        type: String, 
        required: true, 
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    phone: {
        type: String,   // Changed to `String` to avoid number format issues
        required: false,
        unique: true,
        sparse: true,
        default: null
    },
    googleId: {
        type: String,
        required: false,
        unique: true,
        sparse: true,
    },
    password: {
        type: String,
        required: false
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    cart: [{
        type: Schema.Types.ObjectId,
        ref: 'Cart',
    }],
    wallet: {
        type: Number,
        default: 0
    },
    
    walletHistory: [{
        amount: Number,
        type: {
            type: String,
            enum: ['credit', 'debit']
        },
        description: String,
        date: {
            type: Date,
            default: Date.now
        }
    }],
    wishlist: [{
        type: Schema.Types.ObjectId,
        ref: 'wishlist'
    }],
    orderHistory: [{
        type: Schema.Types.ObjectId,
    }],
    createdOn: {
        type: Date,
        default: Date.now,
    },
    referalCode: {
        type: String
    },
    redeemed: {
        type: Boolean,
        default: false
    },
    redeemedUsers: [{
        type: Schema.Types.ObjectId,
        ref: 'User',
    }],
    searchHistory: [{
        category: {
            type: Schema.Types.ObjectId,
            ref: 'Category'
        },
        brand: {
            type: String,
        },
        searchOn: {
            type: Date,
            default: Date.now,
        }
    }]
});

// Pre-save hook to auto-generate customerID
userSchema.pre('save', async function (next) {
    const user = this;

    if (!user.customerID) {
        const counter = await Counter.findOneAndUpdate(
            { name: 'customerID' },
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );
        user.customerID = counter.seq.toString();
    }

    next();
});

const User = mongoose.model('User', userSchema);

module.exports = User;