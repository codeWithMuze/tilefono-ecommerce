const User = require('../../models/userSchema');
const bcrypt = require('bcrypt');
const Order = require('../../models/orderSchema');
const Product=require('../../models/productSchema')
const Brand= require('../../models/brandSchema')
const Category=require('../../models/categorySchema')


const loadLogin = (req, res) => {
    if (req.session.admin) {
        return res.redirect('/admin/dashboard');
    }
    res.render('admin-login', { message: null });
};

const adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Find admin in the database
        const admin = await User.findOne({ email, isAdmin: true });
        
        if (!admin) {
            return res.render('admin-login', { message: "Admin not found!" });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.render('admin-login', { message: "Incorrect password!" });
        }

        // Set admin session
        req.session.admin = admin;
        return res.redirect('/admin/dashboard');
    } catch (error) {
        console.error(error);
        res.render('admin-login', { message: "Something went wrong!" });
    }
};

const loadDashboard = async (req, res) => {
    try {
      if (!req.session.admin) {
        return res.redirect('/admin/login');
      }
  
      const { fromDate, toDate, page = 1, limit = 10, timeFilter = 'all' } = req.query;
      const skip = (page - 1) * limit;
  
      // Log current time for debugging
      const now = new Date();
      console.log('Current time:', now);
  
      // Build date filter
      let dateFilter = {};
      if (timeFilter === 'custom' && fromDate && toDate) {
        const startDate = new Date(fromDate);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
  
        if (!isNaN(startDate) && !isNaN(endDate) && startDate <= endDate) {
          dateFilter = {
            createdOn: {
              $gte: startDate,
              $lte: endDate,
            },
          };
          console.log('Custom date filter:', startDate, 'to', endDate);
        } else {
          console.log('Invalid custom date range, falling back to all');
        }
      } else if (timeFilter !== 'all') {
        const endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
        let startDate;
  
        switch (timeFilter) {
          case 'day':
            startDate = new Date();
            startDate.setDate(endDate.getDate() - 1);
            startDate.setHours(0, 0, 0, 0);
            console.log('Last day filter:', startDate, 'to', endDate);
            break;
          case 'week':
            startDate = new Date();
            startDate.setDate(endDate.getDate() - 7);
            startDate.setHours(0, 0, 0, 0);
            console.log('Last week filter:', startDate, 'to', endDate);
            break;
          case 'month':
            startDate = new Date();
            startDate.setDate(endDate.getDate() - 30);
            startDate.setHours(0, 0, 0, 0);
            console.log('Last month filter:', startDate, 'to', endDate);
            break;
          default:
            console.log('Invalid time filter, falling back to all');
            break;
        }
  
        if (startDate) {
          dateFilter = {
            createdOn: {
              $gte: startDate,
              $lte: endDate,
            },
          };
        }
      }
  
      console.log('Applied dateFilter:', JSON.stringify(dateFilter));
  
      // Fetch basic stats
      const totalUsers = await User.countDocuments({ isAdmin: false });
      const orders = await Order.find(dateFilter).populate('orderedItems.product');
      console.log(`Found ${orders.length} orders for the selected time period`);
  
      const totalSales = orders.reduce((sum, order) => sum + order.finalAmount, 0);
      const itemsSold = orders.reduce((sum, order) => {
        return sum + order.orderedItems.reduce((itemSum, item) => itemSum + item.quantity, 0);
      }, 0);
  
      const pendingOrders = await Order.countDocuments({
        status: 'Pending',
        ...dateFilter,
      });
  
      // Aggregation for top categories
      const topCategories = await Order.aggregate([
        { $match: dateFilter },
        { $unwind: '$orderedItems' },
        {
          $lookup: {
            from: 'products',
            localField: 'orderedItems.product',
            foreignField: '_id',
            as: 'productDetails',
          },
        },
        { $unwind: '$productDetails' },
        {
          $group: {
            _id: '$productDetails.category',
            unitsSold: { $sum: '$orderedItems.quantity' },
            revenue: { $sum: { $multiply: ['$orderedItems.price', '$orderedItems.quantity'] } },
          },
        },
        {
          $lookup: {
            from: 'categories',
            localField: '_id',
            foreignField: '_id',
            as: 'categoryDetails',
          },
        },
        { $unwind: '$categoryDetails' },
        {
          $project: {
            name: '$categoryDetails.name',
            unitsSold: 1,
            revenue: 1,
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 10 },
      ]);
  
      const topBrands = await Order.aggregate([
        { $match: dateFilter },
        { $unwind: '$orderedItems' },
        {
          $lookup: {
            from: 'products',
            localField: 'orderedItems.product',
            foreignField: '_id',
            as: 'productDetails',
          },
        },
        { $unwind: '$productDetails' },
        {
          $group: {
            _id: '$productDetails.brand',
            unitsSold: { $sum: '$orderedItems.quantity' },
            revenue: { $sum: { $multiply: ['$orderedItems.price', '$orderedItems.quantity'] } },
          },
        },
        {
          $lookup: {
            from: 'brands',
            localField: '_id',
            foreignField: 'brandName',
            as: 'brandDetails',
          },
        },
        { $unwind: '$brandDetails' },
        {
          $project: {
            name: '$brandDetails.brandName',
            unitsSold: 1,
            revenue: 1,
            imageUrl: '$brandDetails.brandImage',
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 10 },
      ]);
  
      const topProducts = await Order.aggregate([
        { $match: dateFilter },
        { $unwind: '$orderedItems' },
        {
          $group: {
            _id: '$orderedItems.product',
            totalQuantity: { $sum: '$orderedItems.quantity' },
            totalRevenue: { $sum: { $multiply: ['$orderedItems.price', '$orderedItems.quantity'] } },
            price: { $first: '$orderedItems.price' },
          },
        },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'productDetails',
          },
        },
        { $unwind: '$productDetails' },
        {
          $project: {
            id: '$productDetails._id',
            name: '$productDetails.productName',
            brand: '$productDetails.brand',
            amount: '$price',
            revenue: '$totalRevenue',
            qtySold: '$totalQuantity',
            imageUrl: {
              $concat: ['/Uploads/product-images/', { $arrayElemAt: ['$productDetails.productImage', 0] }],
            },
          },
        },
        { $sort: { revenue: -1, _id: 1 } },
        { $skip: skip },
        { $limit: parseInt(limit) },
      ]);
  
      const totalProductsCount = await Order.aggregate([
        { $match: dateFilter },
        { $unwind: '$orderedItems' },
        { $group: { _id: '$orderedItems.product' } },
        { $count: 'total' },
      ]);
      const totalPages = Math.ceil((totalProductsCount[0]?.total || 0) / limit);
  
      const salesData = await Order.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: {
              $dateToString: { format: '%d %b', date: '$createdOn' },
            },
            totalSales: { $sum: '$finalAmount' },
          },
        },
        { $sort: { '_id': 1 } },
      ]);
  
      res.render('dashboard', {
        pageTitle: 'Dashboard',
        totalUsers,
        totalSales,
        itemsSold,
        pendingOrders,
        topCategories,
        topBrands,
        topProducts,
        salesData,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          limit: parseInt(limit),
          fromDate,
          toDate,
        },
        timeFilter,
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
      res.status(500).render('error', { message: 'Failed to load dashboard' });
    }
  };
const logoutAdmin = (req, res) => {
    req.session.admin = null;
    res.redirect('/admin/login');
};


const pageError=async (req,res)=>{
    res.render('admin-error')
}

const loadPage = (req, res) => {
    const page = req.params.page; 
    res.render(`admin/${page}`, { pageTitle: page.charAt(0).toUpperCase() + page.slice(1) });
};

const logout= async (req,res)=>{
    try{
        req.session.destroy(err=>{
            if(err){
                console.log('Error description session',err)
                return res.redirect('/pageError')
            }
            return res.redirect('/admin/login')
        })
    }catch (error){
        console.log('unexpected error during logout',error)
        res.redirect('/pageError')
    }
}

// Get orders with pagination
const getOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;
        
        // Get orders with populated user information
        const orders = await Order.find()
            .populate('orderedItems.product')
            .populate({
                path: 'address',
                model: 'User',
                select: 'name email phone'
            })
            .sort({ createdOn: -1 })
            .skip(skip)
            .limit(limit);
        
        // Count total orders for pagination
        const totalOrders = await Order.countDocuments();
        const totalPages = Math.ceil(totalOrders / limit);
        
        // Calculate statistics
        const pendingOrders = await Order.countDocuments({ status: { $in: ['Pending', 'Processing'] } });
        const deliveredOrders = await Order.countDocuments({ status: 'Delivered' });
        
        // Calculate total revenue from all orders
        const allOrders = await Order.find();
        const totalRevenue = allOrders.reduce((sum, order) => sum + order.finalAmount, 0);
        
        // Render orders page with dynamic data
        res.render('admin/orders', {
            orders,
            page,
            totalPages,
            stats: {
                totalOrders,
                pendingOrders,
                deliveredOrders,
                totalRevenue
            }
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).send('Internal Server Error');
    }
};

// Get order details by ID
const getOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.id;
        
        // Find order and populate related fields
        const order = await Order.findById(orderId)
            .populate('orderedItems.product')
            .populate({
                path: 'address',
                model: 'User',
                select: 'name email phone'
            });
        
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        // Get user information if available
        if (typeof order.address === 'string') {
            // Try to find the user by address ID
            const user = await User.findById(order.address).select('name email phone');
            if (user) {
                order._doc.user = user;
            }
        }
        
        res.json(order);
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// Update order status
const updateOrderStatus = async (req, res) => {
    try {
        const { orderId, status } = req.body;
        
        // Update order status
        const order = await Order.findByIdAndUpdate(
            orderId,
            { status },
            { new: true }
        );
        
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        // Redirect back to orders page
        res.redirect('/admin/orders');
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).send('Internal Server Error');
    }
};

// Delete order
const deleteOrder = async (req, res) => {
    try {
        const orderId = req.params.id;
        
        // Delete order
        const result = await Order.findByIdAndDelete(orderId);
        
        if (!result) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        // Redirect back to orders page
        res.redirect('/admin/orders');
    } catch (error) {
        console.error('Error deleting order:', error);
        res.status(500).send('Internal Server Error');
    }
};

// Generate invoice
const generateInvoice = async (req, res) => {
    try {
        const orderId = req.params.id;
        
        // Find order and populate related fields
        const order = await Order.findById(orderId)
            .populate('orderedItems.product')
            .populate({
                path: 'address',
                model: 'User',
                select: 'name email phone'
            });
        
        if (!order) {
            return res.status(404).send('Order not found');
        }
        
        // Render invoice template
        res.render('admin/invoice', {
            order,
            user: order.address,
            printMode: true
        });
    } catch (error) {
        console.error('Error generating invoice:', error);
        res.status(500).send('Internal Server Error');
    }
};

module.exports = {
    loadLogin,
    adminLogin,
    loadDashboard,
    logoutAdmin,
    pageError,loadPage,
    logout,
    getOrders,
    getOrderDetails,
    updateOrderStatus,
    deleteOrder,
    generateInvoice
};
