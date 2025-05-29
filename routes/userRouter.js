const express = require('express')
const router = express.Router()
const userController = require('../controllers/user/userController')
const passport = require('passport')
const profileController= require('../controllers/user/profileController')
const {userAuth,adminAuth} = require('../middlewares/auth');
const cartController=require('../controllers/user/cartController')
const paymentController = require('../controllers/user/paymentController')
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
router.post('/cart/addToCart', userController.addToCartInShop);
router.post('/signup', userController.signup);
router.post('/verify-otp', userController.verifyOtp);
router.post('/resend-otp', userController.resendOtp)
router.get('/about', userController.loadAboutPage);
router.get('/contact', userController.loadContactPage);



// Google OAuth routes
router.get('/auth/google',passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback',
passport.authenticate('google', { failureRedirect: '/signup' }),
(req, res) => {
    res.redirect('/home'); 
}
);

// user controller routes
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
router.post('/user/upload-profile-pic', upload.single('profilePic'), profileController.uploadProfilePicture);
router.delete('/user/remove-profile-pic', profileController.removeProfilePicture);



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
//cancel order route 
router.post('/cancel-order/:orderId', userAuth, orderController.cancelOrder);


//payment routes
router.get('/payment-success', userAuth, paymentController.loadPaymentPage)
router.get('/payment/:orderId', userAuth, paymentController.loadRazorpayPaymentPage)
router.post('/verify-payment', userAuth, paymentController.verifyRazorpayPayment)
router.get('/track-order/:orderId', userAuth, paymentController.loadTrackOrder)
router.get('/track-order', userAuth, paymentController.loadTrackOrder)

// Payment failed page route
router.get('/payment-failed', userAuth, paymentController.loadPaymentFailedPage);

// Retry payment API endpoint
router.post('/retry-payment/:orderId', userAuth, paymentController.retryPayment);


// Authentication check
router.get('/check-auth', (req, res) => {
    const isAuthenticated = req.session.user ? true : false;
    res.json({ isAuthenticated });
});

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
