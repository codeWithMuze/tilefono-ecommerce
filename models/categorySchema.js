const mongoose = require('mongoose');
const { Schema } = mongoose;

const categorySchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String,
        required: true
    },
    isListed: {
        type: Boolean,
        default: true  // ✅ Fixed typo here
    },
    categoryOffer: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    // customerID: { 
    //     type: String, 
    //     required: false 
    // },
});

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;
