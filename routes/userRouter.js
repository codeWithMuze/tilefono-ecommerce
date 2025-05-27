const express = require('express')
const router = express.Router()
const userController = require('../controllers/user/userController')
const passport = require('passport')
const profileController= require('../controllers/user/profileController')
const {userAuth,adminAuth} = require('../middlewares/auth');
const cartController=require('../controllers/user/cartController')
const orderController=require('../controllers/user/orderController')
const wishlistController= require('../controllers/user/wishlistController')

const { updateLocale } = require('moment')
const multer = require('multer');
const path = require('path');
const Razorpay = require('razorpay');
const User = require('../models/userSchema');
const Order = require('../models/orderSchema');
const razorpayConfig = require('../config/razorpay');

// Configure multer for profile picture uploads
const storage = multer.diskStorage({
destination: function (req, file, cb) {
    cb(null, 'public/uploads/profile-pictures');
},
filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
}
});

const upload = multer({
storage: storage,
limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Not an image! Please upload an image.'), false);
    }
}
});



router.get('/', (req, res) => {
res.redirect('/home');
});

router.get('/pageNotFound',userController.pageNotFound)
router.get('/home', userController.loadHomePage);
router.get("/signup", userController.loadSignUp);
router.get("/shop",userController.loadShopping);
router.post('/cart/addToCart', userController.addToCartInShop)    // add cart to the userControler page same copy as mattedh
router.post('/signup', userController.signup);
router.post('/verify-otp', userController.verifyOtp);
router.post('/resend-otp', userController.resendOtp)
router.get('/about', userController.loadAboutPage);
router.get('/contact', userController.loadContactPage);




router.get('/auth/google',passport.authenticate('google', { scope: ['profile', 'email'] }));


router.get('/auth/google/callback',
passport.authenticate('google', { failureRedirect: '/signup' }),
(req, res) => {
    res.redirect('/home'); 
}
);

router.get('/login',userController.loadLogin); 
router.post('/login',userController.login);
router.get('/logout',userController.logout)
router.get('/forgot-password',profileController.getForgotPassPage);
router.post('/forgot-password', userController.postForgotPassRequest);
router.get('/OTP-Login',userController.loadOTPLoginPage)
router.post('/verify-signup-otp',userController.postVerifyForgetOtp)

router.post('/forgot-resend-otp', userController.forgetResendOTP);


//profile managment forget email and password
router.post('/forgot-email-valid',profileController.forgotEmailValid)
router.get('/changeEmail',userAuth,profileController.changeEmail);
router.post('/changeEmail',userAuth,profileController.changeEmailValid);
router.post('/verify-email-otp',userAuth,profileController.verifyEmailOtp)
router.post('/update-email',userAuth,profileController.updateEmail)
router.get('/changePassword',userAuth,profileController.changePassword)
router.post('/change-password',userAuth,profileController.changePasswordValid);
router.post('/verify-password-otp',userAuth,profileController.verifyPassOtp);
router.post('/update-password',userAuth,profileController.updatePassword);
router.post('/resend-code',userAuth,profileController.resendOtp);

// Profile Management 
router.get('/userProfile',userAuth,profileController.userProfile)
router.get('/product/:id', userController.loadProductDetail);
// profile photo add
router.post('/update-profile-picture',upload.single('profilePic'),profileController.uploadDP)


//adress management
router.get('/addAddress', userAuth, profileController.addAddress);
router.post('/addAddress', userAuth, profileController.postAddAddress);
router.post('/update-profile', userAuth, profileController.updateProfile);
router.post('/update-address', userAuth, profileController.updateAddress);

// Search route
router.get('/shop', userController.loadShopping);
router.get('/shop/live-search', userController.liveSearch);
router.get('/search', userController.searchProducts);

// Cart Controller
router.get('/cart',cartController.loadCartPage)
router.post('/cart/add', cartController.addToCart)
router.post('/cart/remove/:id', cartController.removeFromCart);
// router.post('/cart/remove',userController.decreaseProductCount)
// router.post('/cart/update',userController.increaseProductCount)
router.post('/cart/update-quantity', userAuth, cartController.updateQuantity);

// Coupon routes
router.get('/coupons/available', userAuth, cartController.getAvailableCoupons);
router.post('/coupons/apply', userAuth, cartController.applyCoupon);
router.post('/coupons/remove', userAuth, cartController.removeCoupon);
router.get('/coupons/check-session', userAuth, cartController.checkCouponSession);

// checkout route
router.get('/checkout', userAuth,userController.loadCheckout)
router.get('/checkout/buy-now', userAuth, userController.loadBuyNowCheckout)

// order route
router.get('/order', userAuth, orderController.loadOrderPage);
router.post('/create-order', userAuth, orderController.createOrder);

// Return order route
// Order return is handled by the /request-return route

//cancel order route 
router.post('/cancel-order/:orderId', userAuth, orderController.cancelOrder);
//payment routes
router.get('/payment-success', userAuth, userController.loadPaymentPage)
router.get('/payment/:orderId', userAuth, userController.loadRazorpayPaymentPage)
router.post('/verify-payment', userAuth, userController.verifyRazorpayPayment)
router.get('/track-order/:orderId', userAuth, userController.loadTrackOrder)
router.get('/track-order', userAuth, userController.loadTrackOrder)

// Payment failed page route
router.get('/payment-failed', userAuth, async (req, res) => {
try {
    const { orderId, error_code, error_message } = req.query;
    
    if (!orderId) {
        return res.status(400).redirect('/order?error=Invalid request. Order ID missing.');
    }
    
    // Fetch the order details
    const order = await Order.findById(orderId);
    
    if (!order) {
        return res.status(404).redirect('/order?error=Order not found.');
    }
    
    // Render the payment failed page
    res.render('payment-failed', {
        order,
        user: req.session.user,
        error: {
            code: error_code,
            message: error_message || 'Payment processing failed.'
        }
    });
} catch (error) {
    console.error('Payment Failed Page Error:', error);
    res.status(500).redirect('/order?error=Something went wrong.');
}
});

// Retry payment API endpoint
router.post('/retry-payment', userAuth, async (req, res) => {
try {
    const { orderId } = req.body;
    
    if (!orderId) {
        return res.status(400).json({
            success: false,
            message: 'Order ID is required'
        });
    }
    
    // Find the order
    const order = await Order.findById(orderId);
    
    if (!order) {
        return res.status(404).json({
            success: false,
            message: 'Order not found'
        });
    }
    
    // Check if this order belongs to the logged-in user
    const user = await User.findOne({
        _id: req.session.user._id,
        orderHistory: { $in: [orderId] }
    });
    
    if (!user) {
        return res.status(403).json({
            success: false,
            message: 'You do not have permission to retry this payment'
        });
    }
    
    // If it's been a while since the order was created, we might want to create a new Razorpay order
    const orderCreatedTime = new Date(order.createdOn || order.createdAt).getTime();
    const currentTime = new Date().getTime();
    const hoursSinceCreation = (currentTime - orderCreatedTime) / (1000 * 60 * 60);
    
    let razorpayOrderId = order.paymentDetails?.razorpayOrderId;
    
    // If order is more than 24 hours old or doesn't have a Razorpay order ID, create a new one
    if (hoursSinceCreation > 24 || !razorpayOrderId) {
        try {
            // Create a new Razorpay order
            const amountInPaise = Math.round(order.finalAmount * 100);
            
            const razorpay = new Razorpay({
                key_id: razorpayConfig.keyId,
                key_secret: razorpayConfig.keySecret
            });
            
            // Try to create a real Razorpay order
            try {
                const basicParams = {
                    amount: amountInPaise,
                    currency: 'INR',
                    receipt: order._id.toString()
                };
                
                const rzpResponse = await razorpay.orders.create(basicParams);
                
                if (rzpResponse && rzpResponse.id) {
                    razorpayOrderId = rzpResponse.id;
                    
                    // Update the order with new Razorpay details
                    order.paymentDetails = {
                        ...order.paymentDetails,
                        razorpayOrderId: razorpayOrderId,
                        retryCount: (order.paymentDetails?.retryCount || 0) + 1,
                        lastRetryDate: new Date()
                    };
                    
                    await order.save();
                }
            } catch (createError) {
                console.error('Failed to create new Razorpay order for retry:', createError);
                
                // Fall back to using a dummy order ID
                razorpayOrderId = 'order_demo_' + Math.random().toString(36).substring(2, 15);
                
                // Update the order with fallback details
                order.paymentDetails = {
                    ...order.paymentDetails,
                    razorpayOrderId: razorpayOrderId,
                    isDemoOrder: true,
                    retryCount: (order.paymentDetails?.retryCount || 0) + 1,
                    lastRetryDate: new Date()
                };
                
                await order.save();
            }
        } catch (error) {
            console.error('Error creating new Razorpay order for retry:', error);
            // Continue with the existing order ID if available, or use a dummy one
            if (!razorpayOrderId) {
                razorpayOrderId = 'order_demo_' + Math.random().toString(36).substring(2, 15);
            }
        }
    }
    
    // Return order details for retry
    return res.json({
        success: true,
        orderId: order._id,
        amount: order.finalAmount,
        razorpayOrderId: razorpayOrderId,
        currency: 'INR',
        isDemoOrder: razorpayOrderId.startsWith('order_demo_')
    });
    
} catch (error) {
    console.error('Retry payment error:', error);
    return res.status(500).json({
        success: false,
        message: 'An error occurred while retrying payment'
    });
}
});

// // Authentication check
// router.get('/check-auth', (req, res) => {
//     const isAuthenticated = req.session.user ? true : false;
//     res.json({ isAuthenticated });
// });

// Wishlist
router.get('/wishlists',userAuth,wishlistController.loadWishlistPage)
router.post('/wishlists/add', userAuth, wishlistController.addToWishlist)
router.delete('/wishlists/remove/:productId', userAuth, wishlistController.removeFromWishlist)
router.post('/wishlists/move-to-cart', userAuth, wishlistController.moveAllToCart)
router.get('/wishlists/check', userAuth, wishlistController.checkWishlistItems)


// Wallet routes
router.post('/add-money-to-wallet', userAuth, profileController.addMoneyToWallet);
router.get('/wallet-transactions', userAuth, profileController.getWalletTransactions);
router.post('/request-return', userAuth, orderController.requestReturn);




module.exports = router;
