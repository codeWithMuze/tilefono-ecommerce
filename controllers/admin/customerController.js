    const User = require('../../models/userSchema');
    const moment = require('moment');
    const Order = require("../../models/orderSchema");


const customerInfo = async (req, res) => {

    try {
        let search = '';
        if(req.query.search){
            search=req.query.search;
        }
        let page=1;
        if(req.query.page){
            page=req.query.page
        }
        const limit=3;
        const totalCustomers = await User.countDocuments({isAdmin:false}); 
        const totalPages = Math.ceil(totalCustomers / limit);

        const startOfMonth = moment().startOf('month').toDate();
        
        // Count customers added this month
        const newCustomersThisMonth = await User.countDocuments({
            isAdmin: false,
            createdAt: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 1)) },
          });

          const activeUsers = await User.countDocuments({
            isAdmin: false,
            isBlocked: false, // Assuming `isBlocked` field indicates block status
          });

          const blockedUsers = await User.countDocuments({
            isAdmin: false,
            isBlocked: true, // Assuming `isBlocked` field indicates block status
          });

        const totalOrders = await Order.countDocuments();
        const totalRevenue = await Order.aggregate([
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);

        const avgOrderValue = totalOrders > 0 ? totalRevenue[0].total / totalOrders : 0; 

        const data = await User.find({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: "i" } },
                { email: { $regex: ".*" + search + ".*", $options: "i" } }
            ]
        })
        .limit(limit)
        .skip((page - 1) * limit)
        .exec();

        const count=await User.find({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: "i" } },
                { email: { $regex: ".*" + search + ".*", $options: "i" } }
            ],

        }).countDocuments();

        res.render('customers',
            { pageTitle: 'Customers',
             data ,totalPages,
              currentPage: page,
              totalCustomers,
              newCustomersThisMonth,
              activeUsers,
              blockedUsers,
              avgOrderValue: avgOrderValue.toFixed(2)
            });

       } catch(error){
        console.log('error happended in customer info', error)
       }
};

const customerBlocked= async (req,res)=>{
    try{
        let id=req.query.id;
        await User.updateOne({_id:id},{$set:{isBlocked:true}})
        res.redirect('/admin/customers')
    } catch(error){
        res.redirect('/pageError')
    }
}

const customerunBlocked= async (req,res)=>{
    try{

        let id=req.query.id;
        await User.updateOne({_id:id},{$set:{isBlocked:false}})
        res.redirect('/admin/customers')
    }
    catch(error){
        res.redirect('/pageError')
    }
};


const editCustomer= async (req,res)=>{
    try {
        const {customerId,name,email,phone} =req.body;
        await User.findByIdAndUpdate(customerId,{
            name,email,phone
        })
        res.redirect('/admin/customers');
    } catch (error) {
        console.log('error occured when editing the customer', error)
        res.status(500).send('Failed to update customer');
        
    }
}

const deleteCustomer= async (req,res)=>{
    try {
        const customerId = req.query.id;
        await User.deleteOne({ _id: customerId });
        res.redirect('/admin/customers?deleted=true'); 
    } catch (error) {
        console.error('Error deleting customer:', error);
        res.status(500).send('Server Error');
      }
}
const getCustomerDetails = async (req, res) => {
    try {
        console.log("Fetching customer details for ID:", req.params.id);
        const user = await User.findById(req.params.id).lean();
        console.log("User found:", user);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const totalOrders = await Order.countDocuments({ userId: user._id }); // Assuming order has a field `userId`
        res.status(200).json({
            ...user,
            totalOrders
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = {
    customerInfo,
    customerBlocked,
    customerunBlocked,
    deleteCustomer,editCustomer,
    getCustomerDetails

};
