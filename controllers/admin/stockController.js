const Product = require('../../models/productSchema')
const Category = require('../../models/categorySchema')

const loadStockPage = async (req, res) => {
    try {
      // Get pagination parameters from query string
      const currentPage = parseInt(req.query.page) || 1;
      const limit = 10;
      const skip = (currentPage - 1) * limit;
      
      // Get filter parameters
      const searchQuery = req.query.search || '';
      const categoryFilter = req.query.category || '';
      const stockStatus = req.query.status || '';
      
      // Build filter query
      let filterQuery = {};
      
      if (searchQuery) {
        filterQuery.$or = [
          { productName: { $regex: searchQuery, $options: 'i' } },
          { _id: { $regex: searchQuery, $options: 'i' } }
        ];
      }
      
      if (categoryFilter) {
        filterQuery.category = categoryFilter;
      }
      
      if (stockStatus === 'in-stock') {
        filterQuery.quantity = { $gt: 5 }; // quantity > reorderLevel
      } else if (stockStatus === 'low-stock') {
        filterQuery.quantity = { $gt: 0, $lte: 5 }; // 0 < quantity <= reorderLevel
      } else if (stockStatus === 'out-of-stock') {
        filterQuery.quantity = 0; // quantity = 0
      }
      
      // Get total count for pagination
      const totalItems = await Product.countDocuments(filterQuery);
      const totalPages = Math.ceil(totalItems / limit);
      
      // Get products with pagination
      const products = await Product.find(filterQuery)
        .populate('category')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
  
      // Calculate stock statistics
      const allProducts = await Product.find().lean();
      const totalProducts = allProducts.length;
      const lowStockItems = allProducts.filter(p => p.quantity <= 5 && p.quantity > 0).length;
      const outOfStockItems = allProducts.filter(p => p.quantity === 0 || !p.quantity).length;
      const inStockItems = totalProducts - outOfStockItems;

      // Get all unique categories for the filter dropdown
      const categories = await Category.find({ isListed: true }).lean();
      
      // Get stock history - placeholder for now, replace with actual model later
      const startDate = req.query.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const endDate = req.query.endDate || new Date().toISOString().split('T')[0];
      
      // Sample stock history - replace with real data when you have a stock history model
      const stockHistory = [
        {
          date: new Date().toISOString().split('T')[0],
          productName: "iPhone 13 Pro",
          previousStock: 35,
          updatedStock: 42,
          change: 7,
          updatedBy: "Admin",
          notes: "New shipment arrived"
        }
      ];

      // Format products for the template
      const formattedProducts = products.map(product => {
        // Get the first product image or use a placeholder, following same pattern as product page
        let imageUrl = '/uploads/product-images/default-image.png'; // Default placeholder
        
        if (product.productImage && product.productImage.length > 0) {
          imageUrl = `/uploads/product-images/${product.productImage[0]}`;
        }
        
        return {
          id: product._id,
          name: product.productName || product.name,
          sku: `SKU-${product._id.toString().slice(-6)}`,
          category: product.category?.name || 'Uncategorized',
          stock: product.quantity || 0,
          reorderLevel: 5,
          imageUrl: imageUrl
        };
      });
  
      res.render("stocks", {
        products: formattedProducts,
        totalProducts,
        lowStockItems,
        inStockItems,
        outOfStockItems,
        stockHistory,
        categories,
        currentPage,
        totalPages,
        startDate,
        endDate,
        searchQuery,
        categoryFilter,
        stockStatus,
        pageTitle: 'Stock Management'
      });
    } catch (error) {
      console.error("Error loading stock page:", error);
      res.render("stocks", {
        products: [],
        totalProducts: 0,
        lowStockItems: 0,
        inStockItems: 0,
        outOfStockItems: 0,
        stockHistory: [],
        categories: [],
        currentPage: 1,
        totalPages: 1,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        searchQuery: '',
        categoryFilter: '',
        stockStatus: '',
        pageTitle: 'Stock Management'
      });
    }
  };

const updateStock = async (req, res) => {
  try {
    const { productId, newStock, notes } = req.body;
    
    // Validate input
    if (!productId || newStock === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: 'Product ID and new stock amount are required' 
      });
    }
    
    // Find the product
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    const previousStock = product.quantity || 0;
    const stockChange = parseInt(newStock) - previousStock;
    
    // Update the stock (quantity field in the database)
    product.quantity = parseInt(newStock);
    
    // Update product status based on quantity
    if (parseInt(newStock) === 0) {
      product.status = 'out of stock';
    } else {
      product.status = 'Available';
    }
    
    await product.save();
    
    // Create a record for stock history (you can implement a StockHistory model later)
    // For now we'll just log it
    console.log(`Stock updated for ${product.productName}:`, {
      previousStock,
      newStock: parseInt(newStock),
      change: stockChange,
      notes: notes || 'Stock update',
      updatedAt: new Date(),
      updatedBy: req.session.admin?.email || 'Admin'
    });
    
    return res.json({ 
      success: true, 
      message: 'Stock updated successfully',
      product: {
        id: product._id,
        name: product.productName,
        stock: product.quantity,
        previousStock,
        change: stockChange
      }
    });
  } catch (error) {
    console.error("Error updating stock:", error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to update stock' 
    });
  }
};

const bulkStockUpdate = async (req, res) => {
  try {
    // This is a simplified implementation without actual file processing
    // In a real implementation, you would use a package like 'multer' for file uploads
    // and 'csv-parser' to parse the CSV data
    
    // For now, we'll simulate a successful update with dummy data
    const updatedProducts = [
      { sku: 'SKU-123456', previousStock: 10, newStock: 15 },
      { sku: 'SKU-789012', previousStock: 5, newStock: 20 }
    ];
    
    // In a real implementation, you would:
    // 1. Process the uploaded file
    // 2. For each row in the CSV:
    //    a. Find the product by SKU
    //    b. Update the stock
    //    c. Create a stock history record
    
    return res.json({
      success: true,
      message: 'Bulk stock update simulated',
      updatedCount: updatedProducts.length,
      details: updatedProducts
    });
  } catch (error) {
    console.error("Error processing bulk stock update:", error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process stock update',
      error: error.message
    });
  }
};

const exportStockHistory = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Validate dates
    if (!startDate || !endDate) {
      return res.status(400).send('Start date and end date are required');
    }
    
    // In a real implementation with a StockHistory model:
    // 1. Query for stock history records within the date range
    // 2. Format the data as CSV
    // 3. Set headers and send the file

    // For now, let's create some sample data
    const sampleData = [
      {
        date: new Date().toISOString().split('T')[0],
        productName: "iPhone 13 Pro",
        sku: "SKU-123456",
        previousStock: 35,
        updatedStock: 42,
        change: 7,
        updatedBy: "Admin",
        notes: "New shipment arrived"
      },
      {
        date: new Date(Date.now() - 86400000).toISOString().split('T')[0], // Yesterday
        productName: "Samsung Galaxy S21",
        sku: "SKU-789012",
        previousStock: 20,
        updatedStock: 15,
        change: -5,
        updatedBy: "Admin",
        notes: "Stock adjustment after inventory check"
      }
    ];
    
    // Generate CSV content
    const csvHeader = "Date,Product,SKU,Previous Stock,New Stock,Change,Updated By,Notes\n";
    const csvRows = sampleData.map(record => {
      return `${record.date},"${record.productName}",${record.sku},${record.previousStock},${record.updatedStock},${record.change},"${record.updatedBy}","${record.notes}"`;
    });
    const csvContent = csvHeader + csvRows.join('\n');
    
    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=stock_history_${startDate}_to_${endDate}.csv`);
    
    // Send the CSV file
    return res.send(csvContent);
  } catch (error) {
    console.error("Error exporting stock history:", error);
    return res.redirect('/admin/stocks?error=export_failed');
  }
};
  
module.exports = {
  loadStockPage,
  updateStock,
  bulkStockUpdate,
  exportStockHistory
}