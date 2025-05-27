    const express = require('express');
    const router = express.Router();
    const {userAuth,adminAuth} = require('../middlewares/auth')
    const adminController = require('../controllers/admin/adminController');
    const customerController=require('../controllers/admin/customerController')
    const categoryController= require('../controllers/admin/categoryController')
    const brandController=require('../controllers/admin/brandController')
    const productController=require('../controllers/admin/productController')
    const bannerController= require('../controllers/admin/bannerController')
    const ordersController= require('../controllers/admin/ordersController')
    const stockController=require('../controllers/admin/stockController')
    const offerController=require('../controllers/admin/offerController')
    const couponController= require('../controllers/admin/couponController')
    const salesController= require('../controllers/admin/salesController')
    const multer=require('multer')
    const storage=require("../helpers/multer")
      const upload = multer({
        storage: storage,
        limits: {
          fileSize: 5 * 1024 * 1024, // 5MB limit per file
          files: 5 // Allow up to 5 files
        },
        fileFilter: (req, file, cb) => {
          if (file.mimetype.startsWith('image/')) {
            cb(null, true);
          } else {
            cb(new Error('Only image files are allowed!'), false);
          }
        }
      });
    


    router.get('/login', adminController.loadLogin);
    router.post('/login', adminController.adminLogin); 
    router.get('/dashboard', adminAuth,adminController.loadDashboard);
    router.get('/logout', adminController.logoutAdmin); 
    router.get('/pageError',adminController.pageError)
    router.get('/logout',adminController.logout)
    

    // Customer management 
    router.get('/customers', adminAuth, customerController.customerInfo);
    router.get('/blockCustomer',adminAuth,customerController.customerBlocked)
    router.get('/unblockCustomer',adminAuth,customerController.customerunBlocked);
    router.get("/deleteCustomer", customerController.deleteCustomer);  
    router.post('/customers/update',customerController.editCustomer)
    router.get('/customers/:id/details', customerController.getCustomerDetails);

    // Category Management
    router.get("/category", adminAuth,categoryController.categoryInfo);  
    router.post("/addCategory", adminAuth,categoryController.addCategory);  
    router.post("/addCategoryOffer", adminAuth, categoryController.addCategoryOffer)
    router.post('/removeCategoryOffer',adminAuth, categoryController.removeCategoryOffer)
    router.get('/listCategory',adminAuth, categoryController.getListCategory)
    router.get('/unlistCategory',adminAuth, categoryController.getUnlistCategory)
    router.get('/editCategory',adminAuth, categoryController.getEditCategory);
    router.get('/getCategoryData/:id', adminAuth, categoryController.getCategoryData);
    router.put('/updateCategory/:id', adminAuth, categoryController.updateCategory);

    //brand controller
    router.get('/brands',adminAuth,brandController.getBrandPage)
    router.post('/addBrand', adminAuth, upload.single('image'), brandController.addBrand);
    router.get('/blockBrand',adminAuth,brandController.blockBrand)
    router.get('/unBlockBrand', adminAuth, brandController.unBlockBrand)
    router.get('/deleteBrand', adminAuth, brandController.deleteBrand)

    // product management
    router.get('/product-add', adminAuth, productController.getProductAddPage)
    router.post('/addProducts',adminAuth,upload.array("images",5),productController.addProducts)
    router.get('/products',adminAuth,productController.getAllProducts)
    router.get('/product/data/:id', productController.getProductData);
    router.post('/product/edit/:id', upload.array('newImages',5), productController.editProduct);
    router.post('/product/delete/:id', productController.deleteProduct);
    router.post('/product/block/:id', adminAuth, productController.blockProduct);
    router.post('/product/unblock/:id', adminAuth, productController.unblockProduct);
    
    // Route to get all categories for the product edit modal
    router.get('/categories', adminAuth, productController.getCategories);

    router.post('/addProductOffer', adminAuth, productController.addProductOffer);
    router.post('/removeProductOffer', adminAuth, productController.removeProductOffer);
    router.get('/blockProduct',adminAuth,productController.blockProduct)
    router.get('/unblockProduct',adminAuth,productController.unblockProduct)
    
    //Banner Management
    router.get('/banner',adminAuth,bannerController.getBannerPage)
    router.get('/addBanner',adminAuth,bannerController.getAddBannerPage)
    router.post('/addBanner',adminAuth,upload.single('bannerImage'),bannerController.addBanner)
    router.get('/deleteBanner',adminAuth,bannerController.deleteBanner)

    // Order management routes
    router.get('/orders', adminAuth, ordersController.loadOrdersPage);
    router.get('/orders/:id', adminAuth, ordersController.getOrderDetails);
    router.post('/update-order-status', adminAuth, ordersController.updateOrderStatus);
    router.get('/delete-order/:id', adminAuth, ordersController.deleteOrder);
    router.get('/invoice/:id', adminAuth, ordersController.generateInvoice);
    router.post('/approve-return', adminAuth, ordersController.approveReturn);
    router.post('/reject-return', adminAuth, ordersController.rejectReturn);


    //stock management
    router.get('/stocks',adminAuth, stockController.loadStockPage)
    router.post('/update-stock', adminAuth, stockController.updateStock)
    router.post('/bulk-stock-update', adminAuth, stockController.bulkStockUpdate)
    router.get('/export-stock-history', adminAuth, stockController.exportStockHistory)

    // offer management
    router.get('/offer',adminAuth, offerController.loadOfferPage)
    router.post('/offer/add', adminAuth, offerController.addOffer)
    router.put('/offer/update/:id', adminAuth, offerController.updateOffer)
    router.delete('/offer/delete/:id', adminAuth, offerController.deleteOffer)
    router.get('/offer/:id', adminAuth, offerController.getOfferById)
    router.post('/offers/apply', adminAuth, offerController.applyOffer)
    router.patch('/offer/list/:id', adminAuth, offerController.listOffer)
    router.patch('/offer/unlist/:id', adminAuth, offerController.unlistOffer)

    // coupon management
    router.get('/coupon',adminAuth,couponController.loadCouponPage)
    router.post('/coupon/create', adminAuth, couponController.createCoupon)
    router.put('/coupon/update/:id', adminAuth, couponController.updateCoupon)
    router.delete('/coupon/delete/:id', adminAuth, couponController.deleteCoupon)
    router.get('/coupons', adminAuth, couponController.getAllCoupons)
    router.get('/coupon/:id', adminAuth, couponController.getCouponById)


    // sales report management
    router.get('/salesReport',adminAuth,salesController.loadSalesReport)
    router.get('/sales',adminAuth,salesController.loadSalesReport)
    router.get('/export-sales',adminAuth,salesController.exportSalesReport)
    // router.get('/filter-sales',adminAuth,salesController.getFilteredSalesData)
    
    module.exports = router;
