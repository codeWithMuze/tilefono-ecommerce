const Category= require('../../models/categorySchema')
const Order = require("../../models/orderSchema"); 
const Product = require("../../models/productSchema");


const categoryInfo= async (req,res)=>{

    try{
        const page=parseInt(req.query.page) || 1;
        const limit=4;
        const skip=(page-1)*limit;

        const categoryData= await Category.find({})
        .sort({createdAt:-1})
        .skip(skip)
        .limit(limit)

        const productsByCategory = await Product.aggregate([
            {
                $group: {
                    _id: "$category", // Group by category
                    products: { $push: "$$ROOT" }, // Collect all products in this category
                    totalProducts: { $sum: 1 } // Count total products in this category
                }
            },
            {
                $lookup: {
                    from: "categories", // Join with categories collection
                    localField: "_id",
                    foreignField: "_id",
                    as: "categoryDetails"
                }
            },
            {
                $unwind: "$categoryDetails" // Convert array to object
            },
            {
                $project: {
                    _id: 1,
                    categoryName: "$categoryDetails.name",
                    totalProducts: 1,
                    products: 1
                }
            }
        ]);


        const totalSales = await Order.aggregate([
            { $unwind: "$items" }, // Flatten order items
            {
                $lookup: {
                    from: "products",
                    localField: "items.productId",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },
            { $unwind: "$productDetails" },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: { $multiply: ["$items.quantity", "$productDetails.price"] } }
                }
            }
        ]);

        const totalRevenue = totalSales.length > 0 ? totalSales[0].totalRevenue : 0;

        const pendingOrders = await Order.countDocuments({ status: "pending" });

        const totalCategories=await Category.countDocuments()
        const totalPages=Math.ceil(totalCategories / limit)
        const productsCategories = await Category.countDocuments({ 'products.0': { $exists: true } });
        const listedrCategories = await Category.countDocuments({ isListed: true });
        const unlistedCategories = await Category.countDocuments({ isListed: false });


        
        res.render('category',{
            cat:categoryData,
            currentPage:page,
            totalPages:totalPages, 
            totalCategories:totalCategories,
            pageTitle: 'Category',
            productsByCategory,
            totalRevenue,pendingOrders,
            productsCategories,
            listedrCategories,unlistedCategories
        })

    }catch(error){
        console.error(error)
        res.redirect('/pageError')
    }
};

const addCategory = async (req,res)=>{
    const {name,description}=req.body;
    try{
        const existCategory=await Category.findOne({name})
        if(existCategory){
            return res.status(400).json({success:false, error:'Category is already exist'})
        }

        const newCategory= new Category({
            name,description,
        })
        await newCategory.save()
        return res.status(201).json({ success: true, message: "New category added!" })
    } catch(error){
        return res.status(500).json({ success:false,  message:"Internal Server Error"})
    }
}


const addCategoryOffer = async (req, res) => {
    try {
        const percentage = parseInt(req.body.percentage); // Fix typo
        const categoryId = req.body.categoryId;
        
        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({ status: false, message: "Category not found" });
        }

        const products = await Product.find({ category: category._id });
        
        // Fix: Correct variable name & logic for checking product offers
        const hasProductOffer = products.some(product => product.productOffer > percentage);
        if (hasProductOffer) {
            return res.json({ status: false, message: "Some products in this category have higher product offers" });
        }

        // Fix: Correct update query
        await Category.updateOne({ _id: category._id }, { $set: { categoryOffer: percentage } });

        // Reset product offers
        for (const product of products) {
            product.productOffer = 0;
            product.salePrice = product.regularPrice;
            await product.save();
        }

        res.json({ status: true, message: "Category offer added successfully!" });
    } catch (error) {
        console.error("Error in addCategoryOffer:", error);
        res.status(500).json({ status: false, message: "Internal Server Error" });
    }
};


const removeCategoryOffer = async (req, res) => {
    try {
        const categoryId = req.body.categoryId;

        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({ status: false, message: "Category not found" });
        }

        const percentage = category.categoryOffer;
        const products = await Product.find({ category: category._id });

        // Reset product prices
        for (const product of products) {
            product.salePrice = Math.floor(product.regularPrice * (1 + percentage / 100));
            product.productOffer = 0;
            await product.save();
        }

        // Reset category offer
        category.categoryOffer = 0;
        await category.save();

        res.json({ status: true, message: "Category offer removed successfully!" });
    } catch (error) {
        console.error("Error in removeCategoryOffer:", error);
        res.status(500).json({ status: false, message: "Internal Server Error" });
    }
};


const getListCategory = async (req, res) => {
    try {
        let id = req.query.id;
        await Category.updateOne({_id: id}, {$set: {isListed: false}});

        
        // Check if it's an AJAX request
        if (req.xhr) {
            return res.json({ success: true, status: 'unlisted' });
        }
        
        res.redirect("/admin/category");
    } catch (error) {
        if (req.xhr) {
            return res.status(500).json({ success: false, error: error.message });
        }
        res.redirect('/pageError');
    }
}

const getUnlistCategory = async (req, res) => {
    try {
        let id = req.query.id;
        await Category.updateOne({_id: id}, {$set: {isListed: true}});
        
        // Check if it's an AJAX request
        if (req.xhr) {
            return res.json({ success: true, status: 'listed' });
        }
        
        res.redirect('/admin/category');
    } catch (error) {
        if (req.xhr) {
            return res.status(500).json({ success: false, error: error.message });
        }
        res.redirect('/pageError');
    }
}

const getEditCategory= async(req,res)=>{
    try {
        const id=req.query.id;
        const category= await Category.findOne({_id:id})
        res.render('edit-category',{category:category})
    } catch (error) {
        res.redirect('/pageError')
        
    }
}

const getCategoryData = async (req, res) => {
    try {
        const categoryId = req.params.id;
        const category = await Category.findById(categoryId);

        if (!category) {
            return res.status(404).json({ message: "Category not found" });
        }

        res.json(category);
    } catch (error) {
        console.error("Error fetching category:", error);
        res.status(500).json({ message: "Internal server error" });
    }};

const updateCategory = async (req, res) => {
        try {
        const categoryId = req.params.id;
        const { name, description, offerPrice, status } = req.body;

        console.log("Received update request for:", categoryId);
        console.log("Received data:", req.body);

        const updatedCategory = await Category.findByIdAndUpdate(
            categoryId,
            {
                name,
                description,
                categoryOffer: offerPrice, // Ensure this field exists in the schema
                isListed: status === "listed",
            },
            { new: true }
        );

        if (!updatedCategory) {
            return res.status(404).json({ message: "Category not found" });
        }

        console.log("Updated category:", updatedCategory);

        res.json({ success: true, message: "Category updated successfully!", updatedCategory });
    } catch (error) {
        console.error("Error updating category:", error);
        res.status(500).json({ message: "Internal server error" });
    }

};



module.exports={
    categoryInfo,
    addCategory,addCategoryOffer,
    removeCategoryOffer,getListCategory,
    getUnlistCategory,getEditCategory,
    getCategoryData,
    updateCategory 
    
}