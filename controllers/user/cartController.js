const Cart=require('../../models/cartSchema')
const mongoose = require('mongoose');
const Wishlist= require('../../models/wishlistSchema')
const Offer = require('../../models/offerSchema')
const Coupon = require('../../models/couponSchema');

function getBestOffer(applicableOffers, product) {
    if (!Array.isArray(applicableOffers) || applicableOffers.length === 0) return null;
  
    let bestOffer = null;
    let maxDiscount = 0;
  
    for (const offer of applicableOffers) {
        let discount = 0;
        const salePrice = product.salePrice || 0;
  
        if (salePrice <= 0) {
            console.log(`Invalid sale price for product: ${product.productName}`);
            continue;
        }
  
        if (offer.discountType === 'flat') {
            discount = offer.discountAmount;
            if (discount >= salePrice) {
                console.log(`Offer skipped for product ${product.productName}: Flat discount (${discount}) exceeds or equals sale price (${salePrice})`);
                continue;
            }
        } else if (offer.discountType === 'percentage') {
            discount = (salePrice * offer.discountAmount) / 100;
            if (discount >= salePrice) {
                console.log(`Offer skipped for product ${product.productName}: Percentage discount (${discount}) exceeds or equals sale price (${salePrice})`);
                continue;
            }
        }
  
        if (discount > maxDiscount) {
            maxDiscount = discount;
            bestOffer = offer;
        }
    }
  
    return bestOffer;
}

const loadCartPage = async (req, res) => {
    try {

        if (!req.session.user) {
            return res.redirect('/login?message=Please%20login%20to%20view%20your%20cart%20items&redirect=cart');
        }

        const userId = req.session.user._id;
        const cart = await Cart.findOne({ userId }).populate({
            path: 'items.productId',
            select: 'productName regularPrice salePrice productImage brand category subCategory'
        });
    
        if (!cart || cart.items.length === 0) {
            return res.render("cart", { cartItems: [], total: 0, user: req.session.user });
        }

        const cartItems = [];
        

        for (const item of cart.items) {
            const product = item.productId;
            

            const productOffers = await Offer.find({
                offerType: 'Product',
                applicableTo: product._id,
                isDeleted: false,
                isListed: true,
                validFrom: { $lte: new Date() },
                validUpto: { $gte: new Date() }
            }).sort({ discountAmount: -1 });
            

            const categoryOffers = await Offer.find({
                offerType: 'Category',
                applicableTo: product.category,
                isDeleted: false,
                isListed: true,
                validFrom: { $lte: new Date() },
                validUpto: { $gte: new Date() }
            }).sort({ discountAmount: -1 });


            const brandOffers = await Offer.find({
                offerType: 'Brand',
                offerTypeRef: 'Brand',
                isDeleted: false,
                isListed: true,
                validFrom: { $lte: new Date() },
                validUpto: { $gte: new Date() }
            }).populate('applicableTo').then(offers => {
                return offers.filter(offer => {
                    const brand = offer.applicableTo;
                    return brand && brand.brandName === product.brand;
                });
            });
            

            const allOffers = [
                ...productOffers.map(offer => ({
                    ...offer.toObject(),
                    offerSource: 'product',
                    offerLabel: 'Product Offer'
                })),
                ...categoryOffers.map(offer => ({
                    ...offer.toObject(),
                    offerSource: 'category',
                    offerLabel: 'Category Offer'
                })),
                ...brandOffers.map(offer => ({
                    ...offer.toObject(),
                    offerSource: 'brand',
                    offerLabel: 'Brand Offer'
                }))
            ];
            

            allOffers.sort((a, b) => b.discountAmount - a.discountAmount);
            

            const bestOffer = allOffers.length > 0 ? allOffers[0] : null;
            

            let discountedPrice = product.regularPrice;
            if (bestOffer) {
                if (bestOffer.discountType === 'flat') {
                    discountedPrice = Math.max(0, product.regularPrice - bestOffer.discountAmount);
                } else { 
                    const discountAmount = (product.regularPrice * bestOffer.discountAmount) / 100;
                    discountedPrice = Math.max(0, product.regularPrice - discountAmount);
                }
            }
            
            cartItems.push({
                product: product,
                quantity: item.quantity,
                bestOffer: bestOffer,
                discountedPrice: discountedPrice,
                totalPrice: discountedPrice * item.quantity
            });
        }

        const total = cartItems.reduce((sum, item) => sum + item.totalPrice, 0);
    
        res.render("cart", {
            cartItems,
            total,
            user: req.session.user
        });
    } catch (error) {
        console.error('Error loading cart:', error);
        res.status(500).send("Internal Server Error");
    }
}
  

const addToCart = async (req, res) => {
    console.log('User session:', req.session.user);
    try {
        const userId = req.session.user._id;
        const { productId, quantity = 1 } = req.body;
        let { price, totalPrice } = req.body;


        if (!price || !totalPrice) {
            const product = await mongoose.model('Product').findById(productId);
            if (!product) {
                return res.status(404).json({ success: false, message: 'Product not found' });
            }
            price = product.salePrice || product.regularPrice;
            totalPrice = price * quantity;
        }


        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart({ userId, items: [] });
        }


        const existingItem = cart.items.find(item => item.productId.toString() === productId);

        if (existingItem) {

            existingItem.quantity += quantity;
            existingItem.totalPrice = existingItem.price * existingItem.quantity;
        } else {

            cart.items.push({
                productId,
                quantity,
                price,
                totalPrice
            });
        }

        await cart.save();
        const wishlist = await Wishlist.findOne({ userId });
    if (wishlist) {
      wishlist.products = wishlist.products.filter(
        (item) => item.productId.toString() !== productId
      );
      await wishlist.save();
        res.json({ success: true, message: 'Product added to cart successfully' });

    } } catch (error) {
        console.error('Error adding to cart:', error);
        res.status(500).json({ success: false, message: 'Failed to add product to cart' });
    }
};


const removeFromCart = async (req, res) => {
    try {

        if (!req.session.user || !req.session.user._id) {
            return res.status(401).json({ 
                success: false, 
                message: 'Please login to continue' 
            });
        }

        const userId = req.session.user._id;
        const productId = req.params.id;


        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid user ID' 
            });
        }
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid product ID' 
            });
        }

        // Find cart
        console.log('Finding cart for user:', userId, 'Product:', productId); // Debug
        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({ 
                success: false, 
                message: 'Cart not found' 
            });
        }


        const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);
        if (itemIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                message: 'Product not found in cart' 
            });
        }

        cart.items.splice(itemIndex, 1);
        await cart.save();

        return res.json({ 
            success: true, 
            message: 'Product removed from cart successfully' 
        });
    } catch (error) {
        console.error('Error removing from cart:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Failed to remove product from cart',
            error: error.message 
        });
    }
};


const updateQuantity = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { productId, quantity } = req.body;


        if (!productId || quantity === undefined || quantity < 1) {
            return res.status(400).json({
                success: false,
                message: 'Invalid input parameters'
            });
        }


        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({
                success: false,
                message: 'Cart not found'
            });
        }

        if(quantity<cart.items.quantity){
            return res.json({
                success:false,
                message:'Product is not available for this stock'
            })
        }


        const cartItem = cart.items.find(item => 
            item.productId.toString() === productId
        );

        if (!cartItem) {
            return res.status(404).json({
                success: false,
                message: 'Product not found in cart'
            });
        }


        cartItem.quantity = quantity;


        await cart.save();


        res.json({
            success: true,
            message: 'Quantity updated successfully',
            newQuantity: quantity
        });

    } catch (error) {
        console.error('Error updating quantity:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update quantity'
        });
    }
};


const getAvailableCoupons = async (req, res) => {
    try {
        const now = new Date();
        

        const coupons = await Coupon.find({
            isList: true,
            createdOn: { $lte: now },
            expireOn: { $gte: now }
        }).sort({ createdOn: -1 });
        

        res.status(200).json({
            success: true,
            coupons: coupons.map(coupon => ({
                id: coupon._id,
                code: coupon.name,
                discountType: coupon.discountType,
                discountValue: coupon.offerPrice,
                minimumPrice: coupon.minimumPrice,
                description: coupon.description || `${coupon.discountType === 'percentage' ? coupon.offerPrice + '%' : '₹' + coupon.offerPrice} off on orders above ₹${coupon.minimumPrice}`
            }))
        });
    } catch (error) {
        console.error('Error fetching coupons:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch available coupons'
        });
    }
};


const applyCoupon = async (req, res) => {
    try {
        const { couponCode } = req.body;
        const userId = req.session.user._id;
        
        if (!couponCode) {
            return res.status(400).json({
                success: false,
                message: 'Coupon code is required'
            });
        }
        

        const coupon = await Coupon.findOne({ name: couponCode });
        
        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: 'Invalid coupon code'
            });
        }
        

        const now = new Date();
        if (!coupon.isList || coupon.createdOn > now || coupon.expireOn < now) {
            return res.status(400).json({
                success: false,
                message: 'This coupon has expired or is not active'
            });
        }
        

        if (coupon.userId && coupon.userId.includes(userId)) {
            return res.status(400).json({
                success: false,
                message: 'You have already used this coupon'
            });
        }
        

        const cart = await Cart.findOne({ userId }).populate({
            path: 'items.productId',
            select: 'productName regularPrice salePrice'
        });
        
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Your cart is empty'
            });
        }
        

        let subtotal = 0;
        cart.items.forEach(item => {
            const price = item.productId.salePrice || item.productId.regularPrice;
            subtotal += price * item.quantity;
        });
        

        if (subtotal < coupon.minimumPrice) {
            return res.status(400).json({
                success: false,
                message: `This coupon requires a minimum order of ₹${coupon.minimumPrice}`
            });
        }
        

        let discountAmount = 0;
        
        // Log the actual coupon values to debug
        console.log('Coupon details:', {
            name: coupon.name,
            type: coupon.discountType,
            offerPrice: coupon.offerPrice,
            minimumPrice: coupon.minimumPrice,
            subtotal: subtotal
        });
        
        if (coupon.discountType === 'percentage') {
            // Ensure we're working with numbers
            const percentage = Number(coupon.offerPrice);
            const total = Number(subtotal);
            
            // Calculate exact percentage
            const exactDiscount = (total * percentage) / 100;
            
            // Round to nearest rupee
            discountAmount = Math.round(exactDiscount);
            
            console.log(`Coupon calculation: ${percentage}% of ₹${total} = ₹${exactDiscount} (rounded to ₹${discountAmount})`);
            
            // Double-check our math
            const actualPercentage = (discountAmount / total) * 100;
            console.log(`Actual discount percentage: ${actualPercentage.toFixed(2)}%`);
        } else {
            discountAmount = coupon.offerPrice;
            console.log(`Fixed discount: ₹${discountAmount}`);
        }
        

        req.session.appliedCoupon = {
            code: coupon.name,
            discountType: coupon.discountType,
            discountValue: coupon.offerPrice,
            discountAmount: discountAmount
        };
        

        return res.status(200).json({
            success: true,
            coupon: {
                code: coupon.name,
                discountType: coupon.discountType,
                discountValue: coupon.offerPrice,
                discountAmount: discountAmount,
                subtotal: subtotal
            },
            message: 'Coupon applied successfully'
        });
        
    } catch (error) {
        console.error('Error applying coupon:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to apply coupon'
        });
    }
};


// Function to check if a coupon is applied in the session
const checkCouponSession = async (req, res) => {
    try {
        // Check if user is logged in
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
        }

        // Check if there's a coupon in the session
        if (req.session.appliedCoupon && req.session.appliedCoupon.discountAmount) {
            return res.status(200).json({
                success: true,
                hasCoupon: true,
                couponData: req.session.appliedCoupon
            });
        } else {
            return res.status(200).json({
                success: true,
                hasCoupon: false
            });
        }
    } catch (error) {
        console.error('Error checking coupon session:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to check coupon status'
        });
    }
};

// Function to remove coupon from session
const removeCoupon = async (req, res) => {
    try {
        // Check if user is logged in
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
        }

        // Remove the coupon from the session
        if (req.session.appliedCoupon) {
            delete req.session.appliedCoupon;
            console.log('Coupon removed from session successfully');
        }

        return res.status(200).json({
            success: true,
            message: 'Coupon removed successfully'
        });
    } catch (error) {
        console.error('Error removing coupon:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to remove coupon'
        });
    }
};

module.exports = {
    loadCartPage,
    addToCart,
    removeFromCart,
    updateQuantity,
    getAvailableCoupons,
    applyCoupon,
    removeCoupon,
    checkCouponSession
};
