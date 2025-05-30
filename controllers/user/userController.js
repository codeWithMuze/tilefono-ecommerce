const User = require('../../models/userSchema');
const Category = require('../../models/categorySchema')
const Product = require('../../models/productSchema')
const Counter = require('../../models/counterSchema');
const Banner = require('../../models/bannerSchema')
const Brand = require('../../models/brandSchema')
const Cart = require('../../models/cartSchema')
const Address = require('../../models/addressSchema')
const Order = require('../../models/orderSchema')
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv').config();
const bcrypt = require('bcrypt');
const Offer = require('../../models/offerSchema');
const Coupon = require('../../models/couponSchema');
const { Console } = require('console');
const generateReferralCode = require('../../utils/referralCodeGenerator');


function getBestOffer(applicableOffers, product) {
  if (!Array.isArray(applicableOffers) || applicableOffers.length === 0) return null;

  let bestOffer = null;
  let maxDiscount = 0;

  for (const offer of applicableOffers) {
    let discount = 0;
    const regularPrice = product.regularPrice || 0;

    if (regularPrice <= 0) {
      console.log(`Invalid regular price for product: ${product.productName}`);
      continue;
    }

    if (offer.discountType === 'flat') {
      discount = offer.discountAmount;
      if (discount >= regularPrice) {
        console.log(`Offer skipped for product ${product.productName}: Flat discount (${discount}) exceeds or equals regular price (${regularPrice})`);
        continue;
      }
    } else if (offer.discountType === 'percentage') {
      discount = (regularPrice * offer.discountAmount) / 100;
      if (discount >= regularPrice) {
        console.log(`Offer skipped for product ${product.productName}: Percentage discount (${discount}) exceeds or equals regular price (${regularPrice})`);
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

const pageNotFound = async (req, res) => {
  try {
    res.render('page-404');
  } catch (error) {
    res.redirect('/pageNotFound');
  }
};

const loadSignUp = async (req, res) => {
  try {
    return res.render("signup", { message: "" });

  } catch (error) {
    console.log('Home page is not loading', error);
    res.status(500).send('Server error');
  }
};


const loadAboutPage = async (req, res) => {
  try {
    res.render('about', { title: 'About Us' });
  } catch (error) {
    console.error('Error loading About page:', error);
    res.status(500).send('Internal Server Error');
  }
};

const loadContactPage = async (req, res) => {
  try {
    res.render('contact', { title: 'Contact Us' });
  } catch (error) {
    console.error('Error loading Contact page:', error);
    res.status(500).send('Internal Server Error');
  }
};


const loadHomePage = async (req, res) => {
  try {
    const today = new Date().toISOString();
    const findBanner = await Banner.find({
      startDate: { $lt: new Date(today) },
      endDate: { $gt: new Date(today) }
    });
    const user = req.session.user;

    let allProducts = await Product.find({
      isBlocked: false,
      quantity: { $gt: 0 }
    }).select('_id productName salePrice productImage discount regularPrice isFeatured category brand')
      .populate('category brand')
      .lean();

    // Fetch all active offers
    const offers = await Offer.find({
      isListed: true,
      isDeleted: false,
      validFrom: { $lte: new Date() },
      validUpto: { $gte: new Date() }
    }).lean();

    // Attach offers to products
    const processedProducts = allProducts.map(product => {
      // Process the image path
      let images = [];
      if (product.productImage && Array.isArray(product.productImage)) {
        images = product.productImage.map(img => img.replace(/\\/g, '/'));
      }

      const actualDiscount = product.regularPrice - product.salePrice;
      const discountPercentage = product.regularPrice
        ? Math.round((actualDiscount / product.regularPrice) * 100)
        : 0;

      const limitedProductName = (product.productName || 'Unnamed Product')
        .split(' ')
        .slice(0, 15)
        .join(' ');

      // Filter offers applicable to this product
      const productOffers = offers.filter(offer => {
        if (offer.offerType === 'Product' && offer.applicableTo.toString() === product._id.toString()) {
          return true;
        }
        if (offer.offerType === 'Brand' && offer.applicableTo.toString() === product.brand?._id?.toString()) {
          return true;
        }
        if (offer.offerType === 'Category' && offer.applicableTo.toString() === product.category?._id?.toString()) {
          return true;
        }
        return false;
      });

      // Sort offers by discount amount (highest first)
      productOffers.sort((a, b) => b.discountAmount - a.discountAmount);

      return {
        ...product,
        productName: limitedProductName,
        salePrice: product.salePrice || 0,
        regularPrice: product.regularPrice || 0,
        discount: actualDiscount || 0,
        productImage: images,
        discountPercentage: discountPercentage,
        offers: productOffers // Attach offers to the product
      };
    });

    // Organize products into sections
    let featuredProducts = processedProducts.filter(p => p.isFeatured);
    if (featuredProducts.length < 3) {
      const remainingNeeded = 3 - featuredProducts.length;
      const nonFeaturedProducts = processedProducts.filter(p => !p.isFeatured);
      const randomProducts = [];
      for (let i = 0; i < remainingNeeded && i < nonFeaturedProducts.length; i++) {
        const randomIndex = Math.floor(Math.random() * nonFeaturedProducts.length);
        randomProducts.push(nonFeaturedProducts.splice(randomIndex, 1)[0]);
      }
      featuredProducts = [...featuredProducts, ...randomProducts];
    }
    featuredProducts = featuredProducts.slice(0, 3);

    const topOffers = processedProducts
      .filter(p => p.offers && p.offers.length > 0) // Ensure products have offers
      .sort((a, b) => b.offers[0].discountAmount - a.offers[0].discountAmount) // Sort by highest discount
      .slice(0, 3);

    const bestDeals = processedProducts
      .filter(p => p.salePrice >= 40000 && p.regularPrice > p.salePrice)
      .sort((a, b) => b.discount - a.discount)
      .slice(0, 3);

    const under25000 = processedProducts
      .filter(p => p.salePrice < 25000)
      .sort((a, b) => a.salePrice - b.salePrice)
      .slice(0, 3);

    const organizedProducts = {
      featured: featuredProducts,
      topOffers: topOffers,
      under25000: under25000,
      bestDeals: bestDeals
    };

    if (user) {
      const userData = await User.findOne({ _id: user._id });
      return res.render('home', {
        user: userData,
        products: organizedProducts,
        banner: findBanner || [],
        imageBasePath: '/uploads/product-images/'
      });
    } else {
      return res.render('home', {
        products: organizedProducts,
        banner: findBanner || [],
        imageBasePath: '/uploads/product-images/'
      });
    }
  } catch (error) {
    console.error('Error in loadHomePage:', error);
    return res.render('home', {
      products: {
        featured: [],
        topOffers: [],
        under25000: [],
        bestDeals: []
      },
      banner: [],
      error: 'Unable to load products at the moment',
      imageBasePath: '/uploads/product-images/'
    });
  }
};

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(email, otp) {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD
      }
    });

    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Verify your account",
      text: `Your OTP is ${otp}`,
      html: `<b>Your OTP: ${otp}</b>`
    });
    return info.accepted.length > 0;
  } catch (error) {
    console.error("Error sending email", error);
    return false;
  }
}

const liveSearch = async (req, res) => {
  try {
    const query = req.query.query || '';
    const categoryName = req.query.category || '';

    const regex = new RegExp(query, 'i');

    let filter = {
      productName: { $regex: regex },
      isBlocked: false
    };


    if (categoryName) {
      const categoryDoc = await Category.findOne({
        name: { $regex: new RegExp(categoryName, 'i') }
      });

      if (categoryDoc) {
        filter.category = categoryDoc._id;
      } else {

        return res.json({ products: [] });
      }
    }

    const products = await Product.find(filter).limit(20);
    res.json({ products });

  } catch (error) {
    console.error('Live search error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};




const loadShopping = async (req, res) => {
  try {
    const search = req.query.search || "";
    const sort = req.query.sort || "newest";
    const page = parseInt(req.query.page) || 1;
    const limit = 8;
    const category = req.query.category || "";
    const brandFilter = req.query.brand || "";
    const priceMin = parseInt(req.query.priceMin) || null;
    const priceMax = parseInt(req.query.priceMax) || null;

    const categories = await Category.find({ isListed: true });
    const brands = await Brand.find({ isBlocked: false });
    const userData = req.session.user;

    const query = {
      isBlocked: false,
      quantity: { $gt: 0 }
    };

    if (category) {
      const categoryDoc = await Category.findOne({ name: category });
      if (categoryDoc) {
        query.category = categoryDoc._id;
      }
    }

    if (brandFilter) {
      query.brand = { $regex: new RegExp(brandFilter, 'i') };
    }

    if (search) {
      query.$or = [
        { productName: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (priceMin !== null) {
      query.salePrice = { ...query.salePrice, $gte: priceMin };
    }
    if (priceMax !== null) {
      query.salePrice = { ...query.salePrice, $lte: priceMax };
    }

    let sortOption = {};
    switch (sort) {
      case 'price_low':
        sortOption = { salePrice: 1 };
        break;
      case 'price_high':
        sortOption = { salePrice: -1 };
        break;
      default:
        sortOption = { createdAt: -1 };
    }

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);

    const products = await Product.find(query)
      .sort(sortOption)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('category')
      .lean();

    // Fetch all active offers
    const offers = await Offer.find({
      isListed: true,
      isDeleted: false,
      validFrom: { $lte: new Date() },
      validUpto: { $gte: new Date() }
    }).lean();

    // Attach offers to products
    const processedProducts = products.map(product => {
      const productOffers = offers.filter(offer => {
        if (offer.offerType === 'Product' && offer.applicableTo.toString() === product._id.toString()) {
          return true;
        }
        if (offer.offerType === 'Category' && offer.applicableTo.toString() === product.category._id.toString()) {
          return true;
        }
        if (offer.offerType === 'Brand' && offer.applicableTo.toString() === product.brand.toString()) {
          return true;
        }
        return false;
      });

      productOffers.sort((a, b) => b.discountAmount - a.discountAmount);

      const bestOffer = productOffers[0] || null;

      if (bestOffer) {
        const discountAmount = bestOffer.discountType === 'percentage'
          ? (product.regularPrice * bestOffer.discountAmount) / 100
          : bestOffer.discountAmount;

        product.finalPrice = Math.max(0, product.regularPrice - discountAmount);
        product.discountPercentage = bestOffer.discountType === 'percentage'
          ? bestOffer.discountAmount
          : Math.round((discountAmount / product.regularPrice) * 100);
        product.bestOffer = bestOffer;
      } else {
        product.finalPrice = product.salePrice || product.regularPrice;
        product.discountPercentage = 0;
        product.bestOffer = null;
      }

      return product;
    });

    res.render("shop", {
      products: processedProducts,
      totalPages,
      currentPage: page,
      search,
      sort,
      category,
      categories,
      brands,
      priceMin,
      priceMax,
      findUser: userData,
      totalProducts,
      limit,
      message: "Welcome to our shop!"
    });
  } catch (error) {
    console.error("Error in loadShopping:", error);
    res.redirect('/pageError');
  }
};

const addToCartInShop = async (req, res) => {
  try {
    const userId = req.session.user?._id;

    if (!userId) {
      console.log('🚫 User not logged in');
      return res.status(401).json({ success: false, message: 'User not logged in' });
    }

    const { productId, quantity, price, totalPrice } = req.body;
    console.log('✅ Received data:', { productId, quantity, price, totalPrice });

    if (!productId || !quantity || !price || !totalPrice) {
      return res.status(400).json({ success: false, message: 'Missing cart data' });
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      console.log('🆕 Creating new cart');
      cart = new Cart({ userId, items: [] });
    }

    const existingItem = cart.items.find(item => item.productId.toString() === productId);

    if (existingItem) {
      console.log('🔁 Updating existing item');
      existingItem.quantity += quantity;
      existingItem.totalPrice = existingItem.price * existingItem.quantity;
    } else {
      console.log('➕ Adding new item');
      cart.items.push({ productId, quantity, price, totalPrice });
    }

    await cart.save();
    console.log('✅ Cart saved');
    res.json({ success: true, message: 'Product added to cart successfully' });

  } catch (error) {
    console.error('❌ Error adding to cart:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const signup = async (req, res) => {
  try {
    const { name, phone, email, password, confirmPassword, referralCode } = req.body;


    if (referralCode) {
      const user = await User.find({ referralCode: referralCode })

      if (!user) {
        return res.render('signup', { message: "Invalid referral code" });
      }
    }

    if (password !== confirmPassword) {
      return res.render('signup', { message: "Passwords do not match" });
    }


    const findUser = await User.findOne({ email });
    if (findUser) {
      return res.render("signup", { message: "User with this email already exists" });
    }

    const findUser2 = await User.findOne({ phone });
    if (findUser2) {
      return res.render("signup", { message: "User with this phone number already exists, try to login with this number" });
    }


    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);

    if (!emailSent) {
      return res.json({ success: false, message: "Email error" });
    }



    const counter = await Counter.findOneAndUpdate(
      { name: 'customerID' },  // 
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    const customerID = counter.seq.toString().padStart(6, '0');

    req.session.userOtp = otp;
    req.session.userData = { name, phone, email, password, customerID, referralCode };
    req.session.save();



    res.render("verify-otp");
    console.log("OTP Sent:", otp);

  } catch (error) {
    console.error("Signup error", error);
    res.redirect('/pageNotFound');
  }
};



const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    console.log("OTP entered by user:", otp);
    console.log("OTP stored in session:", req.session.userOtp);

    if (otp.toString().trim() === req.session.userOtp.toString().trim()) {
      const user = req.session.userData;
      console.log("User data from session:", user);
      
      const passwordHash = await bcrypt.hash(user.password, 10);

      const refferal = user.referralCode
      const transactionId = generateCode()
      if (refferal) {
        const refferedUser = await User.findOne({ referralCode: refferal })
        console.log("Referred user found:", refferedUser);
        
        const userId = refferedUser._id

        let userWallet = await User.findOne({ _id: userId });
        
        console.log("User wallet before update:", userWallet.wallet);
        


        userWallet.wallet += 1000;
        userWallet.walletHistory.push({
          amount: 1000,
          type: 'credit',
          description: `Reward for reffering ${user.name}`,
          transactionId,
          date: new Date()
        });


        await userWallet.save();
      }

      const referralCode = generateReferralCode(user.name);

      if(refferal){
        const saveUserData = new User({
          customerID: user.customerID,
          name: user.name,
          email: user.email,
          phone: user.phone,
          password: passwordHash,
          referralCode: referralCode,
          wallet: 500,
        });

        const refferedUser2 = await User.findOne({ referralCode: refferal })
  
        saveUserData.walletHistory.push({
          amount: 500,
          type: 'credit',
          description: `Reward for using refferal code ${refferedUser2.name}`,
          transactionId,
          date: new Date()
        });

        await saveUserData.save();

        req.session.user = saveUserData;
      } else {
        const saveUserData = new User({
          customerID: user.customerID,
          name: user.name,
          email: user.email,
          phone: user.phone,
          password: passwordHash,
          referralCode: referralCode,
        });

        await saveUserData.save();

        req.session.user = saveUserData;
      }
      

      req.session.save(() => {
        return res.json({ success: true, redirectUrl: '/home' });
      })

    } else {
      return res.status(400).json({ success: false, message: "Invalid OTP, please try again" });
    }
  } catch (error) {
    console.error('Error verifying OTP', error);
    return res.status(500).json({ success: false, message: "An error occurred" });
  }
};

function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'WLT';
  for (let i = 0; i < 9; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}


const resendOtp = async (req, res) => {
  console.log('workingh')
  try {
    if (!req.session.userData || !req.session.userData.email) {
      return res.status(400).json({ success: false, message: 'Session expired. Please sign up again.' });
    }

    const { email } = req.session.userData;
    const otp = generateOtp();
    req.session.userOtp = otp;
    console.log('The resend otp is :', otp)

    req.session.save();
    const emailSent = await sendVerificationEmail(email, otp);
    if (emailSent) {
      res.status(200).json({ success: true, message: 'OTP Resent Successfully!' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to resend OTP. Please try again later!' });
    }
  } catch (error) {
    console.error('Error resending OTP', error);
    res.status(500).json({ success: false, message: "Internal Server Error. Please try again." });
  }
};

const loadLogin = async (req, res) => {
  try {
    if (!req.session.user) {
      const message = req.query.message || '';
      const redirect = req.query.redirect || '';
      return res.render('login', { message, });
    } else {
      res.redirect('/home');
    }
  } catch (error) {
    console.error('Error loading login page:', error);
    res.redirect('/pageNotFound');
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const findUser = await User.findOne({ email, isAdmin: false });

    if (!findUser) {
      return res.render('login', { message: 'User not found' });
    }

    if (findUser.isBlocked) {
      return res.render('login', { message: 'Your account has been blocked. Contact support.' });
    }

    const passwordMatch = await bcrypt.compare(password, findUser.password);
    if (!passwordMatch) {
      return res.render('login', { message: 'Incorrect Password' });
    }

    // Store user in session
    req.session.user = {
      _id: findUser._id,
      name: findUser.name,
      email: findUser.email
    };


    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        return res.render('login', { message: 'Error saving session' });
      }
      res.redirect('/home');
    });

  } catch (error) {
    console.error('Login error', error);
    res.render('login', { message: 'Login failed. Please try again later.' });
  }
};



const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.log('Session destruction error', err.message)
        return res.redirect('/pageNotFound')
      }
      return res.redirect('/login')
    })
  } catch (error) {
    console.log('Logout error ', error)
    res.redirect('/pageNotFound')
  }
};
const searchProducts = async (req, res) => {
  try {
    const search = req.query.search || '';
    const category = req.query.category || '';
    const brand = req.query.brand || '';
    const sort = req.query.sort || 'newest';
    const page = parseInt(req.query.page) || 1;
    const limit = 8;
    const skip = (page - 1) * limit;
    const priceMin = parseInt(req.query.priceMin) || 0;
    const priceMax = parseInt(req.query.priceMax) || Number.MAX_SAFE_INTEGER;

    const filter = { isBlocked: false };

    if (search) {
      filter.productName = { $regex: new RegExp(search, 'i') };
    }

    if (category) {
      const categoryDoc = await Category.findOne({
        name: { $regex: new RegExp(category, 'i') }
      });
      if (categoryDoc) {
        filter.category = categoryDoc._id;
      }
    }

    if (brand) {
      filter.brand = { $regex: new RegExp(brand, 'i') };
    }


    if (priceMin || priceMax) {
      filter.salePrice = {};
      if (priceMin) {
        filter.salePrice.$gte = priceMin;
      }
      if (priceMax) {
        filter.salePrice.$lte = priceMax;
      }
    }

    const totalProducts = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .sort({ createdAt: sort === 'newest' ? -1 : 1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalProducts / limit);

    res.json({ products, currentPage: page, totalPages, totalProducts });
  } catch (error) {
    console.error('Product search error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};
const loadProductDetail = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId).populate("category");

    if (!product) {
      return res.status(404).render('404', { message: "Product not found" });
    }


    const relatedProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: productId },
      isBlocked: false,
      quantity: { $gt: 0 }
    })
      .limit(4)
      .sort({ createdAt: -1 });


    const productOffers = await Offer.find({
      offerType: 'Product',
      applicableTo: productId,
      isDeleted: false,
      isListed: true,
      validFrom: { $lte: new Date() },
      validUpto: { $gte: new Date() }
    }).sort({ discountAmount: -1 });


    const categoryOffers = await Offer.find({
      offerType: 'Category',
      applicableTo: product.category._id,
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
    }).populate('applicableTo').sort({ discountAmount: -1 })
      .then(offers => {

        return offers.filter(offer => {
          const brand = offer.applicableTo;
          return brand && brand.brandName === product.brand;
        });
      });

    // Combine all offers
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

    res.render('product-details', {
      product,
      relatedProducts,
      productOffers,
      categoryOffers,
      brandOffers,
      allOffers,
      user: req.session.user || null
    });
  } catch (error) {
    console.error("Error loading product detail:", error);
    res.status(500).render('500', { message: "Something went wrong" });
  }
};

const loadCheckout = async (req, res) => {
  try {
    const userId = req.session.user._id;

    // Populate more fields to get offer information
    const cart = await Cart.findOne({ userId }).populate({
      path: 'items.productId',
      select: 'productName salePrice regularPrice productImage brand category subCategory'
    });

    const user = await User.findById(userId)
    const addressDocument = await Address.findOne({ userId })
    const addresses = addressDocument ? addressDocument.address : []
    const defaultAddress = addresses.find((addr) => addr.isDefault) || addresses[0];

    let totalItems = 0;
    const processedCartItems = [];

    // Process each cart item and find applicable offers
    if (cart && cart.items.length > 0) {
      for (const item of cart.items) {
        const product = item.productId;
        totalItems += item.quantity;

        // Fetch product offers
        const productOffers = await Offer.find({
          offerType: 'Product',
          applicableTo: product._id,
          isDeleted: false,
          isListed: true,
          validFrom: { $lte: new Date() },
          validUpto: { $gte: new Date() }
        }).sort({ discountAmount: -1 });

        // Fetch category offers
        const categoryOffers = await Offer.find({
          offerType: 'Category',
          applicableTo: product.category,
          isDeleted: false,
          isListed: true,
          validFrom: { $lte: new Date() },
          validUpto: { $gte: new Date() }
        }).sort({ discountAmount: -1 });

        // Fetch brand offers
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

        // Combine all offers
        const allOffers = [
          ...productOffers.map(offer => ({
            ...offer.toObject(),
            offerSource: 'product',
            offerLabel: 'Product Offer'
          })),
          ...categoryOffers.map(offer => ({
            ...offer.toObject(),
            offerSource: 'category',
            offerLabel: 'Category Off'
          })),
          ...brandOffers.map(offer => ({
            ...offer.toObject(),
            offerSource: 'brand',
            offerLabel: 'Brand Offer'
          }))
        ];

        // Get the best offer
        const bestOffer = getBestOffer(allOffers, product);

        // Calculate prices and discount
        const regularPrice = product.regularPrice || 0;
        let finalPrice = regularPrice;
        let discountAmount = 0;
        let discountPercentage = 0;
        let offerApplied = false;
        let offerInfo = null;

        if (bestOffer) {
          offerApplied = true;
          offerInfo = {
            id: bestOffer._id,
            name: bestOffer.offerName,
            discountType: bestOffer.discountType,
            discountAmount: bestOffer.discountAmount,
            source: bestOffer.offerSource,
            label: bestOffer.offerLabel
          };

          if (bestOffer.discountType === 'percentage') {
            discountAmount = (regularPrice * bestOffer.discountAmount) / 100;
            discountPercentage = bestOffer.discountAmount;
          } else {
            discountAmount = bestOffer.discountAmount;
            discountPercentage = Math.round((discountAmount / regularPrice) * 100);
          }

          finalPrice = regularPrice - discountAmount;
          if (finalPrice < 0) finalPrice = 0;
        }

        // Calculate subtotal using the final price (after offer discount)
        const subtotal = finalPrice * item.quantity;

        // Add to processed items list
        processedCartItems.push({
          product: {
            productName: product.productName,
            name: product.productName,
            regularPrice: regularPrice,
            finalPrice: finalPrice,
            discountAmount: discountAmount,
            discountPercentage: discountPercentage,
            offerApplied: offerApplied,
            offerInfo: offerInfo,
            images: product.productImage || []
          },
          quantity: item.quantity,
          subtotal: subtotal
        });
      }
    }

    console.log("Cart items prepared for checkout:", JSON.stringify(processedCartItems, null, 2));

    // Calculate total based on final prices (after offer discounts)
    const total = processedCartItems.reduce((sum, item) => sum + item.subtotal, 0);

    let couponDiscount = 0;
    let couponApplied = false;

    // First check for URL parameter coupon discount
    if (req.query.couponDiscount) {
      couponDiscount = parseFloat(req.query.couponDiscount) || 0;
      console.log("Coupon discount from URL:", couponDiscount);

      // Update session with URL parameter coupon
      if (!req.session.appliedCoupon) {
        req.session.appliedCoupon = {};
      }
      req.session.appliedCoupon.discountAmount = couponDiscount;
      couponApplied = true;
    }
    // Then check for coupon applied from cart page (stored in session)
    else if (req.session.appliedCoupon && req.session.appliedCoupon.discountAmount) {
      couponDiscount = parseFloat(req.session.appliedCoupon.discountAmount) || 0;
      console.log("Coupon discount from cart page:", couponDiscount);
      couponApplied = true;
    }
    else {
      console.log("No coupon applied for this checkout");
      // Reset coupon discount to ensure it's not displayed
      couponDiscount = 0;
    }

    console.log("Final coupon discount applied:", couponDiscount);

    res.render('checkout', {
      cartItems: processedCartItems,
      total,
      totalItems,
      address: addresses,
      couponDiscount: couponDiscount,
      couponApplied: couponApplied,
      user: user
    });
  } catch (error) {
    console.error('Error loading checkout page:', error);
    res.status(500).send("Internal Server Error");
  }
};


const loadBuyNowCheckout = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { productId, quantity } = req.query;

    if (!productId) {
      return res.status(400).send("Product ID is required");
    }


    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).send("Product not found");
    }


    const user = await User.findById(userId);
    const addressDocument = await Address.findOne({ userId });
    const addresses = addressDocument ? addressDocument.address : [];


    const itemQuantity = parseInt(quantity) || 1;


    const buyNowItem = {
      product: {
        productName: product.productName,
        productName: product.productName,
        name: product.productName,
        salePrice: product.salePrice,
        price: product.salePrice,
        images: product.productImage || []
      },
      quantity: itemQuantity,
      subtotal: product.salePrice * itemQuantity
    };

    const cartItems = [buyNowItem];
    const total = buyNowItem.subtotal;
    const totalItems = itemQuantity;

    console.log("Buy Now item prepared for checkout:", JSON.stringify(buyNowItem, null, 2));

    res.render('checkout', {
      cartItems,
      total,
      totalItems,
      address: addresses,
      couponDiscount: 0,
      user: user,
      isBuyNow: true,
      buyNowProduct: productId
    });
  } catch (error) {
    console.error('Error loading buy-now checkout page:', error);
    res.status(500).send("Internal Server Error");
  }
};

const loadOTPLoginPage = async (req, res) => {
  try {
    const email = req.session.email

    res.render('OTP-Login', { email });
  } catch (error) {
    console.error('Error rendering OTP login page:', error);
    res.status(500).send('Internal Server Error');
  }
}

const postForgotPassRequest = async (req, res) => {
  try {
    const { email } = req.body
    console.log(email)
    const user = await User.findOne({ email, isAdmin: false })
    if (!user) {
      return res.json({ success: false, message: 'User not Found ' })
    }

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);

    if (!emailSent) {
      return res.json({ success: false, message: "Email error" });
    }
    console.log('your otp for forget password is ', otp)

    req.session.userOtp = otp;
    req.session.otpExpires = Date.now() + 120 * 1000;
    req.session.email = email;


    return res.json({ success: true, message: 'Otp have sent to your email', redirect: 'OTP-Login' })

  } catch (error) {
    console.error("Error in verifyEmailOtp:", error);
    res.redirect('/pageNotFound');
  }
};


const postVerifyOTP = async (req, res) => {
  try {
    const { otp } = req.body;
    const userId = req.session.userId;

    const validOtp = await OTP.findOne({
      userId,
      otp,
      expiresAt: { $gt: Date.now() }
    });

    if (!validOtp) {
      return res.render('OTP-Login', { error: 'Invalid or expired OTP' });
    }

    res.render('verify-otp', { success: 'OTP verified successfully!' });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.redirect('/pageNotFound');
  }
};

const postVerifyForgetOtp = async (req, res) => {
  try {
    const { otp, email } = req.body;

    if (req.session.otpExpires && Date.now() > req.session.otpExpires) {
      return res.status(400).json({ success: false, message: "OTP session expired. Please request a new OTP" })
    }

    if (otp !== req.session.userOtp) {
      return res.json({ success: false, message: 'Invalid OTP  ' })

    }
    delete req.session.userOtp
    delete req.session.email
    const user = await User.findOne({ email, isAdmin: false })
    if (!user) {
      return res.json({ success: false, message: 'User not Found ' })

    }

    req.session.user = user

    res.json({ success: true, message: 'Otp verified Successfully', redirect: '/' });


  } catch (error) {

  }
}

const forgetResendOTP = async (req, res) => {
  try {

    delete req.session.userOtp
    delete req.session.otpExpires

    const email = req.session.email
    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);

    if (emailSent) {
      req.session.userOtp = otp;
      req.session.otpExpires = Date.now() + 120 * 1000;
      console.log('Resent  for Otp', otp)
      return res.json({ success: true, message: "OTP resent successfully." });

    } else {
      return res.json({ success: false, message: "Failed to send OTP. Please try again." });
    }
  } catch (error) {
    console.error("Error resending OTP:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while resending the OTP. Please try again later."
    });
  }
}

module.exports = {
  loadHomePage,
  loadSignUp,
  signup,
  verifyOtp,
  resendOtp,
  pageNotFound,
  loadLogin,
  login,
  logout,
  loadShopping,
  searchProducts, liveSearch,
  loadProductDetail,
  addToCartInShop, loadCheckout,
  loadBuyNowCheckout,
  loadOTPLoginPage,
  postForgotPassRequest,
  postVerifyOTP,
  postVerifyForgetOtp,
  forgetResendOTP,
  loadAboutPage,
  loadContactPage
};
