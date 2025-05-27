const Wishlist = require('../../models/wishlistSchema');
const Product = require('../../models/productSchema');
const Cart = require('../../models/cartSchema');
const mongoose = require('mongoose');

const loadWishlistPage = async (req, res) => {
    try {
        const userId = req.session.user._id;
        
        // Find wishlist with all product details
        const wishlist = await Wishlist.findOne({ userId }).populate({
            path: 'products.productId',
            populate: {
                 path: 'category'
            }
        });
        
        // Format products for the template
        const formattedProducts = wishlist ? wishlist.products.map(item => {
            const product = item.productId;
            return {
                id: product._id,
                name: product.productName || product.name,
                description: product.description || 'No description available',
                price: product.salePrice ? Number(product.salePrice) : (product.price ? Number(product.price) : 0),
                originalPrice: product.originalPrice ? Number(product.originalPrice) : null,
                discount: product.originalPrice ? Math.round((1 - (product.salePrice || product.price || 0) / product.originalPrice) * 100) : 0,
                category: product.category ? product.category.name : 'Uncategorized',
                imageUrl: product.productImage && product.productImage.length > 0 
                    ? `/uploads/product-images/${product.productImage[0]}` 
                    : (product.images && product.images.length > 0 ? product.images[0] : '/api/placeholder/180/180'),
                inStock: product.stock > 0,
                isNew: product.isNew || false,
                rating: product.rating || 5,
                ratingCount: product.reviewCount || 65,
                brand: product.brand || ''
            };
        }) : [];

        // Get random products from database using regular find - pure dynamic products
        const randomProducts = await Product.find()
            .sort({ createdAt: -1 })
            .limit(4)
            .populate('category');
        
        // Format random products
        const formattedRandomProducts = randomProducts.map(product => ({
            id: product._id,
            name: product.name,
            description: product.description || 'No description available',
            price: product.price ? Number(product.price) : 0,
            originalPrice: product.originalPrice ? Number(product.originalPrice) : null,
            discount: product.originalPrice ? Math.round((1 - (product.price || 0) / product.originalPrice) * 100) : 0,
            category: product.category ? product.category.name : 'Uncategorized',
            imageUrl: product.images && product.images.length > 0 ? product.images[0] : '/api/placeholder/180/180',
            inStock: product.stock > 0,
            isNew: product.isNew || false,
            rating: product.rating || 5,
            ratingCount: product.reviewCount || 65
        }));

        res.render('wishlists', { 
            products: formattedProducts,
            recommendations: formattedRandomProducts,
            wishlistCount: formattedProducts.length,
            user: req.session.user
        });
    }
    catch (error) {
        console.error('Error loading wishlist:', error);
        res.render('wishlists', { 
            products: [],
            recommendations: [],
            wishlistCount: 0,
            user: req.session.user,
            error: 'Failed to load your wishlist. Please try again later.'
        });
    }
};

// Add to wishlist
const addToWishlist = async (req, res) => {
    try {
        const { productId } = req.body;
        const userId = req.session.user._id;
        
        console.log('Adding to wishlist:', { userId, productId });
        
        // Check if product exists
        const product = await Product.findById(productId);
        if (!product) {
            console.log('Product not found');
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        
        // Find or create wishlist
        let wishlist = await Wishlist.findOne({ userId });
        console.log('Existing wishlist:', wishlist);
        
        if (!wishlist) {
            console.log('Creating new wishlist');
            wishlist = new Wishlist({ userId, products: [] });
        }
        
        // Check if product is already in wishlist
        const existingItem = wishlist.products.find(item => item.productId.toString() === productId);
        if (existingItem) {
            console.log('Product already in wishlist');
            return res.status(200).json({ success: false, message: 'Product already in wishlist' });
        }
        
        // Add product to wishlist
        wishlist.products.push({ productId });
        await wishlist.save();
        console.log('Product added to wishlist:', wishlist);
        
        return res.status(200).json({ success: true, message: 'Product added to wishlist' });
    } catch (error) {
        console.error('Error adding to wishlist:', error);
        return res.status(500).json({ success: false, message: 'Failed to add product to wishlist' });
    }
};

// Remove from wishlist
const removeFromWishlist = async (req, res) => {
    try {
        const { productId } = req.params;
        const userId = req.session.user._id;
        
        // Update wishlist
        const result = await Wishlist.updateOne(
            { userId },
            { $pull: { products: { productId } } }
        );
        
        if (result.modifiedCount === 0) {
            return res.status(404).json({ success: false, message: 'Product not found in wishlist' });
        }
        
        return res.status(200).json({ success: true, message: 'Product removed from wishlist' });
    } catch (error) {
        console.error('Error removing from wishlist:', error);
        return res.status(500).json({ success: false, message: 'Failed to remove product from wishlist' });
    }
};

// Move all to cart
const moveAllToCart = async (req, res) => {
    try {
        const userId = req.session.user._id;
        
        // Get wishlist
        const wishlist = await Wishlist.findOne({ userId });
        if (!wishlist || wishlist.products.length === 0) {
            return res.status(200).json({ success: false, message: 'No items in wishlist' });
        }
        
        // Get cart or create new one
        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart({ userId, items: [] });
        }
        
        // Add each product to cart
        for (const item of wishlist.products) {
            const productId = item.productId;
            
            // Check if product exists
            const product = await Product.findById(productId);
            if (!product || product.stock <= 0) continue;
            
            // Get price from product - use salePrice as primary, fall back to regularPrice
            const price = product.salePrice || product.regularPrice;
            
            // Check if product is already in cart
            const existingCartItem = cart.items.find(cartItem => 
                cartItem.productId.toString() === productId.toString()
            );
            
            if (existingCartItem) {
                existingCartItem.quantity += 1;
                existingCartItem.totalPrice = existingCartItem.price * existingCartItem.quantity;
            } else {
                cart.items.push({ 
                    productId, 
                    quantity: 1,
                    price: price,
                    totalPrice: price
                });
            }
        }
        
        await cart.save();
        
        // Clear wishlist (optional)
        // wishlist.products = [];
        // await wishlist.save();
        
        return res.status(200).json({ success: true, message: 'All items added to cart' });
    } catch (error) {
        console.error('Error moving items to cart:', error);
        return res.status(500).json({ success: false, message: 'Failed to move items to cart' });
    }
};

// Check user's wishlist items
const checkWishlistItems = async (req, res) => {
    try {
        const userId = req.session.user._id;
        console.log('Checking wishlist for user:', userId);
        
        // Find user's wishlist
        const wishlist = await Wishlist.findOne({ userId });
        console.log('Found wishlist:', wishlist);
        
        if (!wishlist || wishlist.products.length === 0) {
            console.log('No items in wishlist');
            return res.status(200).json({ success: true, wishlistItems: [] });
        }
        
        // Return product IDs in the wishlist
        const wishlistItems = wishlist.products.map(item => item.productId.toString());
        console.log('Wishlist items:', wishlistItems);
        
        return res.status(200).json({ success: true, wishlistItems });
    } catch (error) {
        console.error('Error checking wishlist items:', error);
        return res.status(500).json({ success: false, message: 'Failed to check wishlist items' });
    }
};

module.exports = {
    loadWishlistPage,
    addToWishlist,
    removeFromWishlist,
    moveAllToCart,
    checkWishlistItems
}


