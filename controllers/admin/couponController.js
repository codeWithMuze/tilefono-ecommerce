const Product=require('../../models/productSchema')
const Coupon= require('../../models/couponSchema')



const loadCouponPage = async (req, res) => {
    try {
      const coupons = await Coupon.find().sort({ createdAt: -1 });
      const totalItems = await Coupon.countDocuments();
      const inActiveCoupons=await Coupon.countDocuments({isList:false});
      
      const now=new Date()
      const expiredCount = await Coupon.countDocuments({ expireOn: { $lt: now } });
      const scheduledCoupons = await Coupon.countDocuments({ createdOn: { $gt: now } });
 


      res.render('coupon', { coupons, pageTitle:'Coupon Management',
        totalItems,
        inActiveCoupons,
        expiredCount,
        scheduledCoupons
    });
    } catch (error) {
      console.error('Error loading coupon page:', error.message);
      res.status(500).render('error', { message: 'Failed to load coupon page' });
    }
};


const createCoupon = async (req, res) => {
    try {
        const {
            code,
            name,
            discountValue,
            discountType,
            minPurchase,
            startDate,
            endDate, 
            status,
            description
        } = req.body;


        if (!code || !discountValue || !discountType || !minPurchase || !startDate || !endDate) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }


        const existingCoupon = await Coupon.findOne({ name: code });
        if (existingCoupon) {
            return res.status(400).json({ success: false, message: 'Coupon code already exists' });
        }

        // Create a new coupon
        const newCoupon = new Coupon({
            name: code,
            offerPrice: discountValue,
            discountType: discountType, 
            minimumPrice: minPurchase,
            createdOn: new Date(startDate),
            expireOn: new Date(endDate),
            description: description || name || '', // Add this field to schema if needed
            isList: status === 'active'
        });

        await newCoupon.save();

        res.status(201).json({ 
            success: true, 
            message: 'Coupon created successfully',
            coupon: newCoupon
        });
    } catch (error) {
        console.error('Error creating coupon:', error.message);
        res.status(500).json({ success: false, message: 'Failed to create coupon' });
    }
};


const updateCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            code,
            name,
            discountValue,
            discountType,
            minPurchase,
            startDate,
            endDate,
            status,
            description
        } = req.body;


        const coupon = await Coupon.findById(id);
        if (!coupon) {
            return res.status(404).json({ success: false, message: 'Coupon not found' });
        }


        if (code !== coupon.name) {
            const existingCoupon = await Coupon.findOne({ name: code });
            if (existingCoupon) {
                return res.status(400).json({ success: false, message: 'Coupon code already exists' });
            }
        }

        // Update coupon fields
        coupon.name = code;
        coupon.offerPrice = discountValue;
        coupon.discountType = discountType; 
        coupon.minimumPrice = minPurchase;
        coupon.createdOn = new Date(startDate);
        coupon.expireOn = new Date(endDate);
        coupon.description = description || name || ''; 
        coupon.isList = status === 'active';

        await coupon.save();

        // Return the updated coupon object
        const updatedCoupon = await Coupon.findById(id);

        res.status(200).json({ 
            success: true, 
            message: 'Coupon updated successfully',
            coupon: updatedCoupon
        });
    } catch (error) {
        console.error('Error updating coupon:', error.message);
        res.status(500).json({ success: false, message: 'Failed to update coupon' });
    }
};


const deleteCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const coupon = await Coupon.findByIdAndDelete(id);
        if (!coupon) {
            return res.status(404).json({ success: false, message: 'Coupon not found' });
        }

        res.status(200).json({ success: true, message: 'Coupon deleted successfully' });
    } catch (error) {
        console.error('Error deleting coupon:', error.message);
        res.status(500).json({ success: false, message: 'Failed to delete coupon' });
    }
};


const getAllCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find().sort({ createdOn: -1 });
        res.status(200).json({ success: true, coupons });
    } catch (error) {
        console.error('Error getting coupons:', error.message);
        res.status(500).json({ success: false, message: 'Failed to get coupons' });
    }
};


const getCouponById = async (req, res) => {
    try {
        const { id } = req.params;
        const coupon = await Coupon.findById(id);
        
        if (!coupon) {
            return res.status(404).json({ success: false, message: 'Coupon not found' });
        }

        res.status(200).json({ success: true, coupon });
    } catch (error) {
        console.error('Error getting coupon:', error.message);
        res.status(500).json({ success: false, message: 'Failed to get coupon' });
    }
};

module.exports = {
    loadCouponPage,
    createCoupon,
    updateCoupon,
    deleteCoupon,
    getAllCoupons,
    getCouponById
}