const Product = require('../../models/productSchema')
const Category = require('../../models/categorySchema')
const Brand = require('../../models/brandSchema')
const User = require("../../models/userSchema")
const fs = require('fs')
const path = require("path")
const sharp = require('sharp');


const getProductAddPage = async (req, res) => {
    try {
        const category = await Category.find({ isListed: true });
        const brand = await Brand.find({ isBlocked: false });
        res.render("product-add", {
            cat: category,
            brand: brand,
            pageTitle: "Add New Products",
        });
    } catch (error) {
        res.redirect('/pageError');
    }
};


const addProducts = async (req, res) => {
    try {
        const products = req.body;
        const productExists = await Product.findOne({
            productName: products.productName
        });

        if (!productExists) {
            const images = [];

            if (req.files && req.files.length > 0) {
                const destinationDir = path.join('public', 'uploads', 'product-images');
                // Ensure the destination directory exists
                if (!fs.existsSync(destinationDir)) {
                    fs.mkdirSync(destinationDir, { recursive: true });
                }

                for (let i = 0; i < req.files.length; i++) {
                    const originalimagePath = req.files[i].path;
                    
                    const resizedImageFilename = 'resized_' + req.files[i].filename;
                    const resizedImagePath = path.join(destinationDir, resizedImageFilename);

                    await sharp(originalimagePath)
                        .resize({ width: 440, height: 440 })
                        .toFile(resizedImagePath);

                    // Push the new (resized) image filename, if that's what you want stored.
                    images.push(resizedImageFilename);
                }
            }

            const categoryId = await Category.findOne({ name: products.category });
            if (!categoryId) {
                return res.status(400).send("invalid category name");
            }

            const newProduct = new Product({
                productName: products.productName,
                description: products.description,
                brand: products.brand,
                category: categoryId._id,
                regularPrice: products.regularPrice,
                salePrice: products.salePrice,
                createdOn: new Date(),
                quantity: products.quantity,
                size: products.size,
                color: products.colors,
                productImage: images,
                status: "Available"
            });

            await newProduct.save();
            return res.redirect('/admin/product-add?upload=success');
        } else {
            res.status(400).json("Product already exists, please try with another name");
        }
    } catch (error) {
        console.error("Error occurred when saving product:", error);
        // Update render path to point to the correct view directory
        return res.redirect('/admin/pageError');
    }
};


const getAllProducts = async (req, res) => {
    try {
        const search = req.query.search || "";
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        
        const productData = await Product.find({
            $or: [
                {productName: {$regex: new RegExp(".*" + search + ".*", "i")}},
                {brand: {$regex: new RegExp(".*" + search + ".*", "i")}}
            ],
        }).limit(limit).skip((page - 1) * limit).populate('category').exec();
        
        const count = await Product.find({
            $or: [
                {productName: {$regex: new RegExp(".*" + search + ".*", "i")}},
                {brand: {$regex: new RegExp(".*" + search + ".*", "i")}}
            ],
        }).countDocuments();
        
        const category = await Category.find({isListed: true});
        const brand = await Brand.find({isBlocked: false});
        const totalProduct = await Product.countDocuments(); 

       
        
        if (category && brand) {
            res.render("products", {
                data: productData,
                currentPage: page,
                totalPages: Math.ceil(count / limit),
                cat: category,
                brand: brand,
                search: search,
                pageTitle: "Products",
                totalProduct:totalProduct,

            });
        } else {
            res.render('page-404');
        }
    } catch (error) {
        console.error("Error in getAllProducts:", error);
        res.redirect('/pageError');
    }
};
 

const editProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const updatedData = req.body;

    console.log("🟡 Received Product ID:", productId);
    console.log("🟡 Received Form Data:", updatedData);
    console.log("🟡 Received Files:", req.files);

    const existingProduct = await Product.findById(productId);
    if (!existingProduct) {
      console.error("❌ Product not found");
      return res.status(404).json({ error: "Product not found" });
    }

    let images = [...existingProduct.productImage]; // Start with existing images

    // ✅ Remove selected images from UI (also from server)
    if (updatedData.removedImages) {
      const removedImages = JSON.parse(updatedData.removedImages);
      removedImages.forEach(filename => {
        const filePath = path.join(__dirname, '..', 'public', 'uploads', 'product-images', filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath); // delete from server
        }
      });

      // Remove from array
      images = images.filter(img => !removedImages.includes(img));
    }

    // ✅ Add new uploaded images (if any)
    if (req.files && req.files.length > 0) {
      const destinationDir = path.join('public', 'uploads', 'product-images');
      if (!fs.existsSync(destinationDir)) {
        fs.mkdirSync(destinationDir, { recursive: true });
      }

      for (let i = 0; i < req.files.length; i++) {
        const originalImagePath = req.files[i].path;
      
        // Generate a new unique filename for resized image
        const ext = path.extname(req.files[i].originalname); // e.g. .jpg, .png
        const resizedImageFilename = `resized-${Date.now()}-${i}${ext}`;
        const resizedImagePath = path.join(destinationDir, resizedImageFilename);
      
        await sharp(originalImagePath)
          .resize({ width: 440, height: 440 })
          .toFile(resizedImagePath);
      
        images.push(resizedImageFilename);
      
        // Optionally delete the original uploaded image to save space
        fs.unlinkSync(originalImagePath);
      }      
    }

    // ✅ Update all fields including updated images
    const result = await Product.findByIdAndUpdate(productId, {
      productName: updatedData.productName,
      description: updatedData.description,
      brand: updatedData.brand,
      category: updatedData.category,
      regularPrice: updatedData.regularPrice,
      salePrice: updatedData.salePrice,
      quantity: updatedData.quantity,
      size: updatedData.size,
      color: updatedData.colors,
      productImage: images,
      offer: updatedData.offer || "No Offer",
      status: updatedData.status || "Available"
    });

    console.log("✅ Product updated successfully:", result);
    res.json({ success: true });

  } catch (error) {
    console.error("❌ Error updating product:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};



const getProductData = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId).populate('category').exec();
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }
        res.json(product);
    } catch (error) {
        console.error("Error fetching product data:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};


const deleteProduct = async (req, res) => {
    try {
        const productId = req.params.id;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Remove product images from uploads folder
        if (product.productImage && product.productImage.length > 0) {
            product.productImage.forEach(image => {
                const imagePath = path.join(__dirname, '../../public/uploads/product-images', image);
                if (fs.existsSync(imagePath)) {
                    fs.unlinkSync(imagePath); // Delete image from folder
                }
            });
        }

        // Delete the product from the database
        await Product.findByIdAndDelete(productId);

        res.json({ success: true, message: 'Product deleted successfully' });
    } catch (error) {
        console.error('❌ Error deleting product:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const addProductOffer= async (req,res)=>{
    try{

        const {productId,percentage}= req.body
        const findProduct= await Product.findOne({_id:productId});
        const findCategory= await Category.findOne({_id:findProduct.category})

        if(findCategory.categoryOffer>percentage){
            return res.json({status:false,message:"this product category already has a category offer"})
        }

        findProduct.salePrice= findProduct.salePrice.Math.floor(findProduct.regularPrice*(percentage/100))
        findProduct.productOffer= parseInt(percentage)
        await findProduct.save()
        findcategory.categoryOffer=0;
        await findCategory.save()
        res.json({status:true})
    } catch(error){
        res.redirect('/pageError');
        res.status(500).json({status:false,message:'Internal server error '})
    }
};

const removeProductOffer= async (req,res)=>{
    try{
        const {productId}= req.body;
        const findProduct= await Product.findOne({_id:productId})
        const percentage=findProduct.productOffer;
        findProduct.salePrice = findProduct.salePrice+Math.floor(findProduct.regularPrice*(percentage/100));
        findProduct.productOffer=0;
        await findProduct.save()
        res.json({status:true})
    } catch (error){
        res.redirect('/pageError')
    }
}

const blockProduct = async (req, res) => {
    try {
      const id = req.params.id; 
      await Product.updateOne({ _id: id }, { $set: { isBlocked: true } });
      res.json({ success: true });
    } catch (error) {
      console.error('Block Error:', error);
      res.json({ success: false, error: 'Failed to block product' });
    }
  };
  

  const unblockProduct = async (req, res) => {
    try {
      const id = req.params.id;
      await Product.updateOne({ _id: id }, { $set: { isBlocked: false } });
      res.json({ success: true });
    } catch (error) {
      console.error('Unblock Error:', error);
      res.json({ success: false, error: 'Failed to unblock product' });
    }
  };
  
// Function to get all categories for the edit modal
const getCategories = async (req, res) => {
    try {
        const categories = await Category.find({ isListed: true });
        res.json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Failed to load categories' });
    }
};

module.exports = {
    getProductAddPage,
    addProducts,
    getAllProducts,
    getProductData,
    editProduct,
    deleteProduct,
    removeProductOffer,
    addProductOffer,
    blockProduct,
    unblockProduct,
    getCategories
};