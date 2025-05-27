const Order = require('../../models/orderSchema');
const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');
const Address = require('../../models/addressSchema');
const shippingConfig = require('../../config/shipping');
const Razorpay = require('razorpay');
const razorpayConfig = require('../../config/razorpay');
const crypto = require('crypto');

const razorpay = new Razorpay({
    key_id: razorpayConfig.keyId,
    key_secret: razorpayConfig.keySecret
});

console.log('Razorpay initialized with:');
console.log('- Key ID:', razorpayConfig.keyId ? razorpayConfig.keyId.substring(0, 6) + '...' : 'Not set');
console.log('- Key Secret:', razorpayConfig.keySecret ? 'Set (hidden)' : 'Not set');

const createOrder = async (req, res) => {
    try {
        if (!req.session.user?._id) {
            return res.status(401).json({
                success: false,
                message: 'Session expired. Please log in again.'
            });
        }
        const userId = req.session.user._id;
        const { addressId, paymentMethod } = req.body;

        if (!addressId || !paymentMethod) {
            return res.status(400).json({
                success: false,
                message: 'Address and payment method are required'
            });
        }

        const addressDoc = await Address.findOne({ userId, 'address._id': addressId });
        const address = addressDoc?.address?.find(addr => addr._id.toString() === addressId);
        if (!address) {
            return res.status(400).json({
                success: false,
                message: 'Invalid address'
            });
        }
        const addressString = `${address.name}, ${address.addressLine}, ${address.city}, ${address.state}, ${address.pincode}`;

        const cart = await Cart.findOne({ userId }).populate('items.productId');
        if (!cart || !cart.items || cart.items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Cart is empty'
            });
        }

        for (const item of cart.items) {
            const product = await Product.findById(item.productId._id);
            if (!product || product.stock < item.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Product ${product?.name || 'unknown'} is out of stock or insufficient quantity`
                });
            }
        }

        let totalProductDiscount = 0;
        const orderedItems = cart.items.map(item => {
            const effectivePrice = item.productId.finalPrice || item.productId.salePrice || item.productId.regularPrice;
            const regularPrice = item.productId.regularPrice || item.productId.salePrice;
            const discountPerItem = regularPrice - effectivePrice;
            const totalDiscountForItem = discountPerItem * item.quantity;

            if (discountPerItem > 0) {
                totalProductDiscount += totalDiscountForItem;
            }

            return {
                product: item.productId._id,
                quantity: item.quantity,
                price: effectivePrice
            };
        });

        const totalAmount = cart.items.reduce((total, item) => {
            const effectivePrice = item.productId.finalPrice || item.productId.salePrice || item.productId.regularPrice;
            return total + (effectivePrice * item.quantity);
        }, 0);

        const originalTotalAmount = cart.items.reduce((total, item) => {
            const regularPrice = item.productId.regularPrice || item.productId.salePrice;
            return total + (regularPrice * item.quantity);
        }, 0);

        const shippingFee = 40;
        let couponDiscount = 0;
        let coupenApplied = false;
        let couponCode = null;

        if (req.session.appliedCoupon?.discountAmount) {
            couponDiscount = parseFloat(req.session.appliedCoupon.discountAmount) || 0;
            couponCode = req.session.appliedCoupon.code || null;
            coupenApplied = true;
            console.log('Applied coupon discount:', couponDiscount);
        }

        const finalAmount = totalAmount + shippingFee - couponDiscount;

        console.log('Order calculation breakdown:', {
            originalAmount: originalTotalAmount.toFixed(2),
            productDiscount: totalProductDiscount.toFixed(2),
            totalAfterProductDiscount: totalAmount.toFixed(2),
            couponDiscount: couponDiscount.toFixed(2),
            shippingFee: shippingFee.toFixed(2),
            finalAmount: finalAmount.toFixed(2),
            difference: (originalTotalAmount - finalAmount).toFixed(2)
        });

        let order = new Order({
            orderedItems,
            totalAmount: originalTotalAmount,
            totalPrice: totalAmount,
            productDiscount: totalProductDiscount,
            discount: couponDiscount,
            finalAmount,
            address: addressString,
            status: 'Pending',
            paymentMethod,
            coupenApplied,
            couponCode,
            couponApplied: coupenApplied
        });

        order.status = paymentMethod === 'razorpay' ? 'Pending' : 'Processing';

        await order.save();

        await User.findByIdAndUpdate(userId, {
            $push: { orderHistory: order._id }
        });

        req.session.pendingOrderId = order._id.toString();

        if (paymentMethod === 'wallet') {
            try {
                const paymentResult = await processWalletPayment(userId, finalAmount, order._id.toString());
                if (!paymentResult.success) {
                    // Cleanup: Delete the order if payment fails
                    await Order.findByIdAndDelete(order._id);
                    await User.findByIdAndUpdate(userId, {
                        $pull: { orderHistory: order._id }
                    });
                    return res.status(400).json({
                        success: false,
                        message: paymentResult.message
                    });
                }

                await Order.findByIdAndUpdate(order._id, {
                    paymentDetails: {
                        method: 'wallet',
                        verified: true,
                        paidAt: new Date()
                    }
                });

                // Decrease stock
                for (const item of cart.items) {
                    await Product.updateOne(
                        { _id: item.productId._id },
                        { $inc: { stock: -item.quantity } }
                    );
                }

                // Clear cart
                await Cart.findOneAndUpdate(
                    { userId },
                    { $set: { items: [] } }
                );

                return res.json({
                    success: true,
                    orderId: order._id
                });
            } catch (error) {
                console.error('Wallet payment processing failed:', error);
                // Cleanup: Delete the order if payment fails
                await Order.findByIdAndDelete(order._id);
                await User.findByIdAndUpdate(userId, {
                    $pull: { orderHistory: order._id }
                });
                return res.status(500).json({
                    success: false,
                    message: error.message || 'Failed to process wallet payment'
                });
            }
        } else if (paymentMethod === 'razorpay') {
            try {
                const refreshedOrder = await Order.findById(order._id);

                const originalPrice = refreshedOrder.totalAmount || originalTotalAmount;
                const offerDiscount = refreshedOrder.productDiscount || totalProductDiscount || 0;
                const appliedCouponDiscount = refreshedOrder.discount || couponDiscount || 0;
                const appliedShippingFee = refreshedOrder.shippingFee || shippingFee || 40;

                const accurateFinalAmount = originalPrice - offerDiscount - appliedCouponDiscount + appliedShippingFee;
                const finalOrderAmount = parseFloat(accurateFinalAmount.toFixed(2));
                const amountInPaise = Math.round(finalOrderAmount * 100);

                req.session.verifiedPaymentAmount = finalOrderAmount;

                console.log('Creating Razorpay order with ACCURATE amount breakdown:', {
                    orderId: order._id.toString(),
                    originalPrice: originalPrice,
                    offerDiscount: offerDiscount,
                    couponDiscount: appliedCouponDiscount,
                    shippingFee: appliedShippingFee,
                    calculatedFinalAmount: finalOrderAmount,
                    originalFinalAmount: refreshedOrder.finalAmount,
                    amountInPaise: amountInPaise
                });

                const basicParams = {
                    amount: amountInPaise,
                    currency: 'INR',
                    receipt: order._id.toString()
                };

                const rzpResponse = await razorpay.orders.create(basicParams);
                if (!rzpResponse || !rzpResponse.id) {
                    throw new Error('Invalid response from Razorpay API');
                }

                const razorpayOrderId = rzpResponse.id;
                await Order.findByIdAndUpdate(order._id, {
                    paymentDetails: {
                        razorpayOrderId,
                        currency: 'INR',
                        amount: amountInPaise / 100
                    }
                });

                // Decrease stock
                for (const item of cart.items) {
                    await Product.updateOne(
                        { _id: item.productId._id },
                        { $inc: { stock: -item.quantity } }
                    );
                }

                // Clear cart
                await Cart.findOneAndUpdate(
                    { userId },
                    { $set: { items: [] } }
                );

                return res.json({
                    success: true,
                    orderId: order._id,
                    amount: finalOrderAmount,
                    razorpayOrderId: rzpResponse.id,
                    currency: 'INR'
                });
            } catch (error) {
                console.error('Razorpay order creation failed:', error);
                // Cleanup: Delete the order if payment fails
                await Order.findByIdAndDelete(order._id);
                await User.findByIdAndUpdate(userId, {
                    $pull: { orderHistory: order._id }
                });
                return res.status(500).json({
                    success: false,
                    message: error.message || 'Failed to create Razorpay order',
                    orderId: order._id
                });
            }
        } else {
            // Handle other payment methods (e.g., COD)
            // Decrease stock
            for (const item of cart.items) {
                await Product.updateOne(
                    { _id: item.productId._id },
                    { $inc: { stock: -item.quantity } }
                );
            }

            // Clear cart
            await Cart.findOneAndUpdate(
                { userId },
                { $set: { items: [] } }
            );

            return res.json({
                success: true,
                orderId: order._id
            });
        }
    } catch (error) {
        console.error('Error creating order:', {
            message: error.message,
            stack: error.stack,
            requestBody: req.body
        });
        return res.status(500).json({
            success: false,
            message: error.message || 'Internal Server Error'
        });
    }
};


const processWalletPayment = async (userId, amount, orderId) => {
    try {
        const user = await User.findById(userId);
        if (!user || !user.wallet || user.wallet < amount) {
            return {
                success: false,
                message: 'Insufficient wallet balance'
            };
        }

        user.wallet -= amount;
        user.walletHistory = user.walletHistory || [];
        user.walletHistory.push({
            amount: -amount,
            type: 'debit',
            description: `Purchase payment for order #${orderId || 'unknown'}`,
            date: new Date()
        });
        await user.save();
        return {
            success: true,
            message: 'Payment successful',
            user
        };
    } catch (error) {
        console.error('Error processing wallet payment:', error);
        return {
            success: false,
            message: `Payment processing failed: ${error.message}`
        };
    }
};

const verifyPayment = async (req, res) => {
    try {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature, order_id } = req.body;
        console.log('Payment verification received:', { razorpay_payment_id, razorpay_order_id, order_id });

        const order = await Order.findById(order_id);
        if (!order) {
            console.error('Order not found for ID:', order_id);
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Verify signature
        const generatedSignature = crypto
            .createHmac('sha256', razorpayConfig.keySecret)
            .update(razorpay_order_id + '|' + razorpay_payment_id)
            .digest('hex');

        if (generatedSignature !== razorpay_signature) {
            console.error('Invalid signature for order:', order_id);
            return res.status(400).json({
                success: false,
                message: 'Invalid payment signature'
            });
        }

        // Mark order as paid
        order.status = 'Paid';
        order.paymentDetails = {
            ...order.paymentDetails,
            paymentId: razorpay_payment_id,
            signature: razorpay_signature,
            verified: true,
            paidAt: new Date()
        };
        await order.save();

        return res.json({
            success: true,
            message: 'Payment verified successfully'
        });
    } catch (error) {
        console.error('Error verifying payment:', error);
        return res.status(500).json({
            success: false,
            message: 'Payment verification failed'
        });
    }
};

// Function to load the payment page with verified final amount
async function loadPaymentPage(req, res) {
    try {
        const orderId = req.query.orderId;
        if (!orderId) {
            return res.redirect('/cart');
        }

        // Find the order and verify all price calculations
        const order = await Order.findById(orderId);
        if (!order) {
            return res.redirect('/cart');
        }

        // Store the verified final amount in session for consistency
        req.session.verifiedPaymentAmount = order.finalAmount;
        req.session.verifiedOrderId = orderId;
        
        console.log('Payment page loaded with verified amount:', {
            orderId: orderId,
            originalAmount: order.totalAmount,
            productDiscount: order.productDiscount || 0,
            couponDiscount: order.couponDiscount || 0,
            offerDiscount: order.offerDiscount || 0,
            finalAmount: order.finalAmount,
            verifiedAmount: req.session.verifiedPaymentAmount
        });

        // Pass the order data to the payment view
        const user = req.session.user;
        return res.render('user/payment', { order, user });
    } catch (error) {
        console.error('Error loading payment page:', error);
        return res.redirect('/cart');
    }
}

const loadOrderPage = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const user = await User.findById(userId).populate('orderHistory');
        const orders = await Order.find({
            _id: { $in: user.orderHistory }
        })
        .populate('orderedItems.product')
        .sort({ createdOn: -1 });

        const addressDoc = await Address.findOne({ userId });
        const ordersWithAddresses = orders.map(order => {
            const orderObj = order.toObject();
            if (addressDoc && addressDoc.address && addressDoc.address.length > 0) {
                const shippingAddress = addressDoc.address[0];
                orderObj.shippingInfo = {
                    name: shippingAddress.name,
                    phone: shippingAddress.phone,
                    addressLine: shippingAddress.addressLine || '',
                    city: shippingAddress.city || '',
                    state: shippingAddress.state || '',
                    pincode: shippingAddress.pincode || '',
                    addressType: shippingAddress.addressType || 'Home'
                };
            }
            return orderObj;
        });

        const message = req.query.message || null;
        const error = req.query.error || null;
        res.render('order', { 
            orders: ordersWithAddresses,
            message: message,
            error: error,
            user: req.session.user 
        });
    } catch (err) {
        console.error('Error loading orders:', err);
        res.status(500).send('Internal Server Error');
    }
};

const requestReturn = async (req, res) => {
    try {
        const { orderId, reason, returnComments } = req.body;
        const userId = req.session.user;

        const order = await Order.findOne({ _id: orderId });
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        if (order.status !== 'Delivered') {
            return res.status(400).json({
                success: false,
                message: "Only delivered orders can be returned"
            });
        }

        const deliveryDate = new Date(order.deliveryDate || order.createdOn);
        const returnWindowDays = 7;
        const returnWindowEnd = new Date(deliveryDate);
        returnWindowEnd.setDate(returnWindowEnd.getDate() + returnWindowDays);

        if (new Date() > returnWindowEnd) {
            return res.status(400).json({
                success: false,
                message: `Return window of ${returnWindowDays} days has expired`
            });
        }

        // ✅ Update order with return request
        order.status = 'Return Request';
        order.returnDetails = {
            reason: reason,
            comments: returnComments,
            requestDate: new Date(),
            approvalStatus: 'pending'
        };
        await order.save();

        

        return res.status(200).json({
            success: true,
            message: "Return request submitted successfully"
        });
    } catch (error) {
        console.error("Error requesting return:", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while processing your return request"
        });
    }
};


const cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.session.user._id;
        const order = await Order.findOne({ _id: orderId });
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }
        
        // Check order status - only allow cancellation of 'Processing' orders
        if (order.status !== 'Processing') {
            let message;
            switch(order.status) {
                case 'Pending':
                    message = "This order is still pending payment and cannot be cancelled";
                    break;
                case 'Cancelled':
                    message = "This order has already been cancelled";
                    break;
                case 'Delivered':
                    message = "This order has been delivered and cannot be cancelled";
                    break;
                case 'Returned':
                    message = "This order has been returned and cannot be cancelled";
                    break;
                default:
                    message = `Orders with status '${order.status}' cannot be cancelled`;
            }
            
            return res.status(400).json({
                success: false,
                message: message
            });
        }
        order.status = 'Cancelled';
        await order.save();

        // ✅ Increase stock for each returned product
        for (const item of order.orderedItems) {
            await Product.updateOne(
                { _id: item.product },
                { $inc: { stock: item.quantity } }
            );
        }
        if (order.paymentMethod === 'wallet' || order.paymentMethod === 'razorpay') {
            const refundResult = await processRefundToWallet(userId, order.finalAmount, order._id);
            if (!refundResult.success) {
                console.error("Refund failed:", refundResult.message);
                return res.status(500).json({
                    success: false,
                    message: refundResult.message
                });
            }
        }
        return res.status(200).json({
            success: true,
            message: "Order cancelled successfully. Refund has been processed to your wallet."
        });
    } catch (error) {
        console.error("Error cancelling order:", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while cancelling your order"
        });
    }
};

const processRefundToWallet = async (userId, amount, orderId) => {
    try {
        const user = await User.findById(userId);
        if (!user || !user.wallet || user.wallet < amount) {
            return {
                success: false,
                message: 'Insufficient wallet balance'
            };
        }

        user.wallet -= amount;
        user.walletHistory = user.walletHistory || [];
        user.walletHistory.push({
            amount: -amount,
            type: 'debit',
            description: `Purchase payment for order #${orderId}`,
            date: new Date()
        });
        await user.save();
        return {
            success: true,
            message: 'Payment successful',
            user
        };
    } catch (error) {
        console.error('Error processing wallet payment:', error);
        return {
            success: false,
            message: `Payment processing failed: ${error.message}`
        };
    }
};

module.exports = {
    createOrder,
    loadOrderPage,
    loadPaymentPage,
    requestReturn,
    cancelOrder,
    verifyPayment
};