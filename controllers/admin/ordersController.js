const User = require('../../models/userSchema');
const Order = require("../../models/orderSchema");
const Address = require("../../models/addressSchema");
const Product = require('../../models/productSchema');

// Load all orders page
const loadOrdersPage = async (req, res) => {
  try {
    console.log("Request path:", req.path);
    console.log("Request originalUrl:", req.originalUrl);
    
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    
    // Get orders with populated user information
    let orders = [];
    try {
      // First get all orders
      orders = await Order.find()
        .populate('orderedItems.product')
        .sort({ createdOn: -1 })
        .skip(skip)
        .limit(limit);
      
      console.log(`Found ${orders ? orders.length : 0} orders`);
      
      // Get all users
      const users = await User.find().select('name email phone orderHistory');
      console.log(`Found ${users.length} users`);
      
      // Create a map of order ID to user
      const orderUserMap = {};
      users.forEach(user => {
        if (user.orderHistory && Array.isArray(user.orderHistory)) {
          user.orderHistory.forEach(orderId => {
            orderUserMap[orderId.toString()] = user;
          });
        }
      });
      
      console.log(`Created map with ${Object.keys(orderUserMap).length} order-to-user mappings`);
      
      // Get addresses too
      const addresses = await Address.find();
      
      // Create user ID to addresses map
      const userAddressMap = {};
      addresses.forEach(addressDoc => {
        if (addressDoc.address && addressDoc.address.length > 0) {
          userAddressMap[addressDoc.userId.toString()] = addressDoc.address;
        }
      });
      
      console.log(`Created map with ${Object.keys(userAddressMap).length} user-to-address mappings`);
      
      // Convert orders to objects we can modify
      orders = orders.map(order => {
        const orderObj = order.toObject();
        
        // Try to find the user for this order
        const user = orderUserMap[order._id.toString()];
        if (user) {
          orderObj.user = {
            name: user.name,
            email: user.email,
            phone: user.phone,
            _id: user._id
          };
          
          // Get addresses for this user
          const userAddresses = userAddressMap[user._id.toString()];
          if (userAddresses && userAddresses.length > 0) {
            const primaryAddress = userAddresses[0];
            orderObj.shippingInfo = {
              name: primaryAddress.name || user.name,
              phone: primaryAddress.phone || user.phone,
              address: primaryAddress.landmark || '',
              city: primaryAddress.city || '',
              state: primaryAddress.state || '',
              pincode: primaryAddress.pincode || '',
              addressType: primaryAddress.addressType || 'Home'
            };
          }
        } 
        // Fallback: Use the address field as a reference to the user
        else if (order.address && typeof order.address === 'string') {
          // Try to find this user
          const userId = order.address;
          const addressUser = users.find(u => u._id.toString() === userId);
          
          if (addressUser) {
            orderObj.user = {
              name: addressUser.name,
              email: addressUser.email,
              phone: addressUser.phone,
              _id: addressUser._id
            };
            
            // Check for addresses
            const userAddresses = userAddressMap[userId];
            if (userAddresses && userAddresses.length > 0) {
              const primaryAddress = userAddresses[0];
              orderObj.shippingInfo = {
                name: primaryAddress.name || addressUser.name,
                phone: primaryAddress.phone || addressUser.phone,
                address: primaryAddress.landmark || '',
                city: primaryAddress.city || '',
                state: primaryAddress.state || '',
                pincode: primaryAddress.pincode || '',
                addressType: primaryAddress.addressType || 'Home'
              };
            }
          }
        }
        
        return orderObj;
      });
    } catch (err) {
      console.error('Error fetching orders:', err);
    }
    
    // Ensure orders is always an array
    if (!orders) orders = [];
    
    // Count total orders for pagination
    let totalOrders = 0;
    let totalPages = 1;
    try {
      totalOrders = await Order.countDocuments();
      totalPages = Math.ceil(totalOrders / limit) || 1; // Ensure at least 1 page
    } catch (err) {
      console.error('Error counting orders:', err);
    }
    
    // Calculate statistics
    let pendingOrders = 0;
    let deliveredOrders = 0;
    let totalRevenue = 0;
    
    try {
      pendingOrders = await Order.countDocuments({ status: { $in: ['Pending', 'Processing'] } });
      deliveredOrders = await Order.countDocuments({ status: 'Delivered' });
      
      // Calculate total revenue from all orders
      const allOrders = await Order.find();
      totalRevenue = allOrders.reduce((sum, order) => sum + (order.finalAmount || 0), 0);
    } catch (err) {
      console.error('Error calculating stats:', err);
    }
    
    // Render orders page with dynamic data
    try {
      const totalOrders = await Order.countDocuments();
      
      // Map orders to match the template expectations
      const mappedOrders = orders;
      
      console.log('Debug - Express view paths:', req.app.get('views'));
      console.log('Debug - Request path:', req.path);
      
      // Only use a single order to avoid loop issues
      let singleOrder = null;
      if (orders && orders.length > 0) {
        singleOrder = orders[0]; // Use first order to avoid template errors
      }
      
      // Try to render admin/orders first
      try {
        console.log('Attempting to render admin/orders template');
        res.render('orders', {
          orders: mappedOrders,
          order: singleOrder,
          currentPage: page,
          page,
          totalPages,
          pageTitle: 'Orders',
          pendingOrders,
          deliveredOrders,
          totalRevenue,
          stats: {
            totalOrders,
            pendingOrders,
            deliveredOrders,
            totalRevenue
          }
        });
      } catch (adminTemplateError) {
        console.error('Failed to render /orders, trying orders:', adminTemplateError);
        
        // If admin/orders fails, try the regular orders template
        res.render('orders', {
          orders: mappedOrders,
          order: singleOrder,
          currentPage: page,
          page,
          totalPages,
          pageTitle: 'Orders',
          pendingOrders,
          deliveredOrders,
          totalRevenue,
          stats: {
            totalOrders,
            pendingOrders,
            deliveredOrders,
            totalRevenue
          }
        });
      }
    } catch (renderError) {
      console.error('Error rendering orders page:', renderError);
      res.status(500).send('Error rendering orders page: ' + renderError.message);
    }
  } catch (error) {
    console.error('Error loading orders:', error);
    
    // Render with default values in case of error
    try {
      console.log('Rendering orders template with error defaults');
      
      // Always use 'orders' template
      res.render('orders', {
        orders: [],
        order: null, // Prevent "order is not defined" errors
        currentPage: 1,
        page: 1,
        totalPages: 1,
        pageTitle: 'Orders - Error',
        pendingOrders: 0,
        deliveredOrders: 0,
        totalRevenue: 0,
        stats: {
          totalOrders: 0,
          pendingOrders: 0,
          deliveredOrders: 0,
          totalRevenue: 0
        },
        error: 'Failed to load orders. Please try again.'
      });
    } catch (renderError) {
      console.error('Error rendering error page:', renderError);
      res.status(500).send('Critical error: ' + error.message);
    }
  }
};

// Get order details by ID (API endpoint)
const getOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.id;
    console.log(`Fetching order details for ID: ${orderId}`);
    
    // Simplified approach - find the base order and manually build a safe object
    const orderDoc = await Order.findById(orderId);
    
    if (!orderDoc) {
      console.log(`Order not found for ID: ${orderId}`);
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Create a minimal but properly structured response
    // with hard-coded default values for any missing properties
    const order = {
      _id: orderDoc._id.toString(),
      orderId: orderDoc.orderId || `ORD-${orderDoc._id.toString().substring(0, 8)}`,
      status: orderDoc.status || 'Processing',
      createdOn: orderDoc.createdOn || new Date(),
      invoiceDate: orderDoc.invoiceDate || orderDoc.createdOn || new Date(),
      finalAmount: 0, // We'll calculate this from items
      totalPrice: 0,  // We'll calculate this from items
      discount: orderDoc.discount || 0,
      paymentMethod: orderDoc.paymentMethod || 'Cash on Delivery',
      address: typeof orderDoc.address === 'string' ? orderDoc.address : 'Address not available',

      // User information
      user: {
        name: 'Customer',
        email: 'customer@example.com',
        phone: 'N/A'
      },

      // Shipping information
      shippingInfo: {
        name: 'Customer',
        phone: 'N/A',
        address: 'Address not available',
        city: 'N/A',
        state: 'N/A',
        pincode: 'N/A'
      },

      // Return details with default empty structure
      returnDetails: {
        reason: '',
        comments: '',
        requestDate: null,
        approvalStatus: 'pending'
      },

      // Empty array for ordered items
      orderedItems: []
    };
    
    // Try to get user information if address is a user reference
    try {
      if (typeof orderDoc.address === 'string') {
        const user = await User.findById(orderDoc.address).select('name email phone');
        if (user) {
          order.user = {
            name: user.name || 'Customer',
            email: user.email || 'N/A',
            phone: user.phone || 'N/A'
          };
        }
      }
    } catch (userError) {
      console.error('Error fetching user data:', userError.message);
      // Keep default user values
    }
    
    // Process ordered items - create safe versions that won't cause errors
    if (orderDoc.orderedItems && Array.isArray(orderDoc.orderedItems)) {
      // Process each ordered item
      for (const item of orderDoc.orderedItems) {
        try {
          // Default product information
          let productInfo = {
            _id: 'unknown',
            productName: 'Product',
            productImage: []
          };
          
          // Try to get product data if we have a reference
          if (item.product) {
            const product = await Product.findById(item.product);
            if (product) {
              productInfo = {
                _id: product._id.toString(),
                productName: product.productName || product.name || 'Product',
                productImage: Array.isArray(product.productImage) ? product.productImage : []
              };
            }
          }
          
          // Add a safely structured item to the order
          order.orderedItems.push({
            product: productInfo,
            quantity: Number(item.quantity) || 1,
            price: Number(item.price) || 0
          });
          
          // Add to totals
          const itemTotal = (Number(item.price) || 0) * (Number(item.quantity) || 1);
          order.totalPrice += itemTotal;
        } catch (itemError) {
          console.error('Error processing order item:', itemError.message);
          // Add a placeholder item if there was an error
          order.orderedItems.push({
            product: {
              _id: 'error',
              productName: 'Error loading product',
              productImage: []
            },
            quantity: 1,
            price: 0
          });
        }
      }
    }
    
    // Calculate final amount
    order.finalAmount = order.totalPrice - (Number(order.discount) || 0);
    
    // Set return details if available
    if (orderDoc.returnDetails) {
      order.returnDetails = {
        reason: orderDoc.returnDetails.reason || '',
        comments: orderDoc.returnDetails.comments || '',
        requestDate: orderDoc.returnDetails.requestDate || null,
        approvalStatus: orderDoc.returnDetails.approvalStatus || 'pending'
      };
    }
    
    // Add any debugging information needed
    console.log(`Processed ${order.orderedItems.length} order items`);
    console.log(`Final order total: ${order.totalPrice}, discount: ${order.discount}, final: ${order.finalAmount}`);
    console.log(`Order status: ${order.status}`);
    
    // No need for complex processing anymore - our object is already safely structured
    
    // Send the fully processed order object back to the client
    console.log('Sending order details to client');
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
    res.render('invoice', {
      order,
      user: order.address,
      printMode: true
    });
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).send('Internal Server Error');
  }
};

// Approve return request
const approveReturn = async (req, res) => {
  try {
    const { orderId } = req.body;
    
    // Find the order
    const order = await Order.findById(orderId).populate('orderedItems.product');
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Verify that order status is 'Return Request'
    if (order.status !== 'Return Request') {
      return res.status(400).json({ error: 'Order is not in return requested state' });
    }
    
    // Update order status to 'Returned' and set approval status
    order.status = 'Returned';
    
    if (!order.returnDetails) {
      order.returnDetails = {};
    }
    
    order.returnDetails.approvalStatus = 'approved';
    order.returnDetails.approvalDate = new Date();
    await order.save();
    
    // Restore stock quantities for all returned products
    // When an order is returned, we need to add the returned product quantities
    // back to the available inventory
    console.log('Restoring product stock quantities for returned items...');
    for (const item of order.orderedItems) {
      const productId = item.product._id ? item.product._id : item.product;
      await Product.findByIdAndUpdate(
        productId,
        { $inc: { quantity: item.quantity } }
      );
      console.log(`Increased stock for product ${productId} by ${item.quantity} units`);
    }
    
    // Send success response
    res.status(200).json({ success: true, message: 'Return request approved and product stock restored' });
  } catch (error) {
    console.error('Error approving return:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Reject return request
const rejectReturn = async (req, res) => {
  try {
    const { orderId, rejectionReason } = req.body;
    
    // Find the order
    const order = await Order.findById(orderId);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Verify that order status is 'Return Request'
    if (order.status !== 'Return Request') {
      return res.status(400).json({ error: 'Order is not in return requested state' });
    }
    
    // Update order status back to 'Delivered' and set approval status
    order.status = 'Delivered';
    
    if (!order.returnDetails) {
      order.returnDetails = {};
    }
    
    // Mark return as rejected and store rejection timestamp
    order.returnDetails.approvalStatus = 'rejected';
    order.returnDetails.returnRejected = true; // Flag to prevent future return requests
    order.returnDetails.rejectionDate = new Date();
    order.returnDetails.rejectionReason = rejectionReason || 'Your return request does not meet our return policy requirements.';
    order.returnDetails.rejectionMessage = 'Your return request has been cancelled. If you have questions about this decision, please contact our customer support team.';
    
    await order.save();
    
    // Send success response
    res.status(200).json({ 
      success: true, 
      message: 'Return request cancelled successfully. The customer will be notified.' 
    });
  } catch (error) {
    console.error('Error cancelling return:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = {
  loadOrdersPage,
  getOrderDetails,
  updateOrderStatus,
  deleteOrder,
  generateInvoice,
  approveReturn,
  rejectReturn
};


