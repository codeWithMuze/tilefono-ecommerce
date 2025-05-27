const Offer = require('../../models/offerSchema')
const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const Brand = require('../../models/brandSchema');

const loadOfferPage = async (req, res) => {
  try {
    console.log('Loading offer page...');
    const offers = await Offer.find().sort({ createdAt: -1 });
    
    // Get product, category and brand data for the dropdowns
    const products = await Product.find({ isBlocked: false }).lean();
    const allCategories = await Category.find({}).lean(); // Get all categories first
    const categories = allCategories.filter(cat => cat.isListed !== false); // Filter out only unlisted categories
    const brands = await Brand.find({ isBlocked: false }).lean();
    
    console.log('Data loaded:');
    console.log('All Categories:', JSON.stringify(allCategories, null, 2));
    console.log('Filtered Categories:', JSON.stringify(categories, null, 2));
    console.log('Products:', products.length);
    console.log('Brands:', JSON.stringify(brands, null, 2));
    
    // If this is an AJAX request, return JSON data
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      console.log('Sending JSON response');
      return res.json({ 
        success: true, 
        offers, 
        products, 
        categories, 
        brands 
      });
    }
    
    // Otherwise render the page
    console.log('Rendering offer page with data');
    
    // Create a script to initialize data in the global scope
    const dataScript = `
    <script>
        window.productsData = ${JSON.stringify(products)};
        window.categoriesData = ${JSON.stringify(categories)};
        window.brandsData = ${JSON.stringify(brands)};
        window.offersData = ${JSON.stringify(offers)};
        
        console.log("Data initialized in controller:", {
            products: window.productsData,
            categories: window.categoriesData,
            brands: window.brandsData,
            offers: window.offersData
        });
    </script>`;
    
    res.render('offer', { 
      offers, 
      products, 
      categories, 
      brands, 
      dataScript,
      pageTitle: 'Offer Management'
    });
  } catch (error) {
    console.log(error);
    res.status(500).send('Server Error');
  }
};

const addOffer = async (req, res) => {
  try {
    const { 
      offerName, 
      description, 
      discountType, 
      discountAmount, 
      validFrom, 
      validUpto, 
      offerType, 
      applicableTo 
    } = req.body;

    // Validate inputs
    if (!offerName || !description || !discountType || !discountAmount || !validFrom || !validUpto || !offerType || !applicableTo) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    // Create new offer
    const newOffer = new Offer({
      offerName,
      description,
      discountType,
      discountAmount: Number(discountAmount),
      validFrom: new Date(validFrom),
      validUpto: new Date(validUpto),
      offerType,
      applicableTo,
      offerTypeRef: offerType
    });

    await newOffer.save();
    
    // Apply offer to products if needed
    if (offerType === 'Product') {
      const product = await Product.findById(applicableTo);
      if (product) {
        await Product.findByIdAndUpdate(applicableTo, { 
          isOffer: true, 
          offerPrice: calculateOfferPrice(product.price, discountType, discountAmount) 
        });
      }
    } else if (offerType === 'Category') {
      const products = await Product.find({ category: applicableTo, isBlocked: false });
      for (const product of products) {
        await Product.findByIdAndUpdate(product._id, { 
          isOffer: true, 
          offerPrice: calculateOfferPrice(product.price, discountType, discountAmount) 
        });
      }
    } else if (offerType === 'Brand') {
      const products = await Product.find({ brand: applicableTo, isBlocked: false });
      for (const product of products) {
        await Product.findByIdAndUpdate(product._id, { 
          isOffer: true, 
          offerPrice: calculateOfferPrice(product.price, discountType, discountAmount) 
        });
      }
    }

    res.status(201).json({ success: true, message: 'Offer added successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

const updateOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      offerName, 
      description, 
      discountType, 
      discountAmount, 
      validFrom, 
      validUpto, 
      offerType, 
      applicableTo,
      isListed
    } = req.body;

    // Validate inputs
    if (!offerName || !description || !discountType || !discountAmount || !validFrom || !validUpto || !offerType || !applicableTo) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    // Find the offer
    const offer = await Offer.findById(id);
    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }

    // Remove offer from previous applicable products
    if (offer.offerType === 'Product') {
      await Product.findByIdAndUpdate(offer.applicableTo, { isOffer: false, offerPrice: 0 });
    } else if (offer.offerType === 'Category') {
      const products = await Product.find({ category: offer.applicableTo, isBlocked: false });
      for (const product of products) {
        await Product.findByIdAndUpdate(product._id, { isOffer: false, offerPrice: 0 });
      }
    } else if (offer.offerType === 'Brand') {
      const products = await Product.find({ brand: offer.applicableTo, isBlocked: false });
      for (const product of products) {
        await Product.findByIdAndUpdate(product._id, { isOffer: false, offerPrice: 0 });
      }
    }

    // Update offer
    offer.offerName = offerName;
    offer.description = description;
    offer.discountType = discountType;
    offer.discountAmount = Number(discountAmount);
    offer.validFrom = new Date(validFrom);
    offer.validUpto = new Date(validUpto);
    offer.offerType = offerType;
    offer.applicableTo = applicableTo;
    offer.offerTypeRef = offerType;
    if (isListed !== undefined) {
      offer.isListed = isListed;
    }

    await offer.save();
    
    // Apply offer to new applicable products
    if (offerType === 'Product') {
      const product = await Product.findById(applicableTo);
      if (product) {
        await Product.findByIdAndUpdate(applicableTo, { 
          isOffer: true, 
          offerPrice: calculateOfferPrice(product.price, discountType, discountAmount) 
        });
      }
    } else if (offerType === 'Category') {
      const products = await Product.find({ category: applicableTo, isBlocked: false });
      for (const product of products) {
        await Product.findByIdAndUpdate(product._id, { 
          isOffer: true, 
          offerPrice: calculateOfferPrice(product.price, discountType, discountAmount) 
        });
      }
    } else if (offerType === 'Brand') {
      const products = await Product.find({ brand: applicableTo, isBlocked: false });
      for (const product of products) {
        await Product.findByIdAndUpdate(product._id, { 
          isOffer: true, 
          offerPrice: calculateOfferPrice(product.price, discountType, discountAmount) 
        });
      }
    }

    res.status(200).json({ success: true, message: 'Offer updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

const deleteOffer = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the offer
    const offer = await Offer.findById(id);
    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }

    // Remove offer from applicable products
    if (offer.offerType === 'Product') {
      await Product.findByIdAndUpdate(offer.applicableTo, { isOffer: false, offerPrice: 0 });
    } else if (offer.offerType === 'Category') {
      const products = await Product.find({ category: offer.applicableTo, isBlocked: false });
      for (const product of products) {
        await Product.findByIdAndUpdate(product._id, { isOffer: false, offerPrice: 0 });
      }
    } else if (offer.offerType === 'Brand') {
      const products = await Product.find({ brand: offer.applicableTo, isBlocked: false });
      for (const product of products) {
        await Product.findByIdAndUpdate(product._id, { isOffer: false, offerPrice: 0 });
      }
    }

    // Actually delete the offer from the database instead of just marking it as deleted
    await Offer.findByIdAndDelete(id);

    res.status(200).json({ success: true, message: 'Offer deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

const getOfferById = async (req, res) => {
  try {
    const { id } = req.params;
    const offer = await Offer.findById(id);
    
    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }
    
    res.json({ success: true, offer });
  } catch (error) {
    console.error('Error fetching offer:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Helper function to calculate offer price
function calculateOfferPrice(originalPrice, discountType, discountAmount) {
  if (discountType === 'percentage') {
    return originalPrice - (originalPrice * (discountAmount / 100));
  } else if (discountType === 'fixed') {
    return Math.max(0, originalPrice - discountAmount);
  }
  return originalPrice;
}

// Add this function to handle applying offers from the product details page
const applyOffer = async (req, res) => {
  try {
    const { 
      productId, 
      offerType, 
      discountPercentage, 
      expiryDate, 
      categoryId, 
      brandName 
    } = req.body;

    // Validate inputs
    if (!productId || !offerType || !discountPercentage || !expiryDate) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Current date for valid from
    const validFrom = new Date();
    const validUpto = new Date(expiryDate);
    
    // Create standard offer name and description based on offer type
    let offerName, description, applicableTo;
    let standardOfferType = '';

    switch (offerType) {
      case 'Product Discount':
      case 'Limited Time Offer':
        // Get product data
        const product = await Product.findById(productId);
        if (!product) {
          return res.status(404).json({ success: false, message: 'Product not found' });
        }
        
        offerName = `${offerType}: ${product.productName}`;
        description = `Special discount of ${discountPercentage}% on ${product.productName}`;
        applicableTo = productId;
        standardOfferType = 'Product';
        
        // Calculate discounted price
        const discountedPrice = Math.round(product.salePrice - (product.salePrice * (discountPercentage / 100)));
        
        // Update product with offer info
        await Product.findByIdAndUpdate(productId, {
          productOffer: discountPercentage,
          offerPrice: discountedPrice,
          offerValidUntil: validUpto,
          isOffer: true
        });
        
        console.log(`Applied ${discountPercentage}% discount to product ${product.productName}`);
        break;
        
      case 'Category Offer':
        if (!categoryId) {
          return res.status(400).json({ success: false, message: 'Category ID is required for category offers' });
        }
        
        // Get category data
        const category = await Category.findById(categoryId);
        if (!category) {
          return res.status(404).json({ success: false, message: 'Category not found' });
        }
        
        offerName = `Category Offer: ${category.name}`;
        description = `Special discount of ${discountPercentage}% on all ${category.name} products`;
        applicableTo = categoryId;
        standardOfferType = 'Category';
        
        // Update category with offer info
        await Category.findByIdAndUpdate(categoryId, {
          categoryOffer: discountPercentage,
          offerValidUntil: validUpto
        });
        
        // Apply offer to all products in this category
        const categoryProducts = await Product.find({ category: categoryId });
        let categoryUpdateCount = 0;
        
        for (const prod of categoryProducts) {
          const prodDiscountedPrice = Math.round(prod.salePrice - (prod.salePrice * (discountPercentage / 100)));
          await Product.findByIdAndUpdate(prod._id, {
            categoryOfferPrice: prodDiscountedPrice,
            offerValidUntil: validUpto,
            isOffer: true
          });
          categoryUpdateCount++;
        }
        
        console.log(`Applied ${discountPercentage}% discount to ${categoryUpdateCount} products in category ${category.name}`);
        break;
        
      case 'Brand Offer':
        if (!brandName) {
          return res.status(400).json({ success: false, message: 'Brand name is required for brand offers' });
        }
        
        // Get brand data
        const brand = await Brand.findOne({ brandName: brandName });
        if (!brand) {
          return res.status(404).json({ success: false, message: 'Brand not found' });
        }
        
        offerName = `Brand Offer: ${brandName}`;
        description = `Special discount of ${discountPercentage}% on all ${brandName} products`;
        applicableTo = brand._id;
        standardOfferType = 'Brand';
        
        // Update brand with offer info
        await Brand.findByIdAndUpdate(brand._id, {
          brandOffer: discountPercentage,
          offerValidUntil: validUpto
        });
        
        // Apply offer to all products of this brand
        const brandProducts = await Product.find({ brand: brandName });
        let brandUpdateCount = 0;
        
        for (const prod of brandProducts) {
          const prodDiscountedPrice = Math.round(prod.salePrice - (prod.salePrice * (discountPercentage / 100)));
          await Product.findByIdAndUpdate(prod._id, {
            brandOfferPrice: prodDiscountedPrice,
            brandOffer: discountPercentage,
            offerValidUntil: validUpto,
            isOffer: true
          });
          brandUpdateCount++;
        }
        
        console.log(`Applied ${discountPercentage}% discount to ${brandUpdateCount} products of brand ${brandName}`);
        break;
        
      default:
        return res.status(400).json({ success: false, message: 'Invalid offer type' });
    }

    // Create an offer record in the Offer collection
    const newOffer = new Offer({
      offerName,
      description,
      discountType: 'percentage',
      discountAmount: Number(discountPercentage),
      validFrom,
      validUpto,
      offerType: standardOfferType,
      applicableTo,
      offerTypeRef: standardOfferType,
      isListed: true
    });

    await newOffer.save();

    return res.status(200).json({ 
      success: true, 
      message: `${offerType} has been applied successfully`,
      offer: newOffer
    });
  } catch (error) {
    console.error('Error applying offer:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'An error occurred while applying the offer',
      error: error.message
    });
  }
};

// List offer function
const listOffer = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the offer
    const offer = await Offer.findById(id);
    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }
    
    // Update the isListed status
    offer.isListed = true;
    await offer.save();
    
    return res.status(200).json({ 
      success: true, 
      message: 'Offer listed successfully',
      offer: offer 
    });
  } catch (error) {
    console.error('Error listing offer:', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Unlist offer function
const unlistOffer = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the offer
    const offer = await Offer.findById(id);
    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }
    
    // Update the isListed status
    offer.isListed = false;
    await offer.save();
    
    return res.status(200).json({ 
      success: true, 
      message: 'Offer unlisted successfully',
      offer: offer 
    });
  } catch (error) {
    console.error('Error unlisting offer:', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};

module.exports = {
  loadOfferPage,
  addOffer,
  updateOffer,
  deleteOffer,
  getOfferById,
  applyOffer,
  listOffer,
  unlistOffer
};