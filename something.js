const getCartPage = async (req, res) => {

    try {

        const userId = req.session.user;
        const user = await User.findById(userId);

        if (!user) {
            return res.redirect("/login");
        }

        const cart = await Cart.findOne({ userId })
            .populate({
                path: "items.productId",
                match: { isDelete: false, isListed: true },
                populate: [
                    { path: "category", select: "name" },
                    { path: "subCategory", select: "name" },
                    { path: "brand", select: "name" },
                ],
            })
            .populate("appliedCoupon");

        const coupons = await Coupons.find({
            status: "Active",
            isDelete: false,
            startingDate: { $lte: new Date() },
            expireOn: { $gte: new Date() },
        }).lean();

        if (!cart || !cart.items.length) {
            await Cart.updateOne(
                { userId },
                {
                    totalAmount: 0,
                    offerDiscount: 0,
                    couponDiscount: 0,
                    appliedCoupon: null,
                }
            );

            return res.render("cart", {
                user,
                cartItems: [],
                total: 0,
                coupons,
                appliedCoupon: null,
                offerDiscount: 0,
                couponDiscount: 0,
            });
        }

        const allOffers = await Offer.find({
            isListed: true,
            isDelete: false,
            validUpto: { $gte: new Date() },
        })
            .populate("applicableTo")
            .lean();

        let total = 0;
        let offerDiscount = 0;
        const enhancedCartItems = cart.items.map((item) => {
            const product = item.productId;

            if (!product) {
                return {
                    ...item.toObject(),
                    bestOffer: null,
                    discountedPrice: item.price,
                    totalPrice: item.price * item.quantity,
                    offerAmount: 0,
                };
            }

            const applicableOffers = allOffers.filter((offer) => {
                const offerId = offer.applicableTo?._id?.toString();
                return (
                    (offer.offerType === "Category" && offerId === product.category?._id?.toString()) ||
                    (offer.offerType === "subCategory" && offerId === product.subCategory?._id?.toString()) ||
                    (offer.offerType === "Product" && offerId === product._id.toString()) ||
                    (offer.offerType === "Brand" && offerId === product.brand?._id?.toString())
                );
            });

            let bestOffer = null;
            let discountedPrice = item.price;
            let offerAmount = 0;

            if (applicableOffers.length > 0) {
                bestOffer = applicableOffers.reduce((best, current) => {
                    const bestDiscount = best ? (item.price * best.discountAmount) / 100 : 0;
                    const currentDiscount = (item.price * current.discountAmount) / 100;
                    return currentDiscount > bestDiscount ? current : best;
                }, null);

                if (bestOffer) {
                    const discountAmount = (item.price * bestOffer.discountAmount) / 100;
                    discountedPrice = Math.max(0, item.price - discountAmount);
                    offerAmount = discountAmount * item.quantity;
                }
            }

            const itemTotal = discountedPrice * item.quantity;
            total += itemTotal;
            offerDiscount += offerAmount;

            return {
                ...item.toObject(),
                product,
                bestOffer,
                discountedPrice,
                totalPrice: itemTotal,
                offerAmount, 
            };
        });

        let couponDiscount = 0;
        let appliedCoupon = cart.appliedCoupon;

        if (cart.appliedCoupon) {
            const coupon = cart.appliedCoupon;
            let isCouponValid = true;
            for (const item of cart.items) {
                const product = item.productId;

                if (!product) continue;

                const used = user.usedDiscounts.find((d) => d.productId.toString() === product._id.toString() && d.couponId && d.couponId.toString() === coupon._id.toString() );

                if (used) {
                    isCouponValid = false;
                    break;
                }
            }

            if (total < coupon.minimumPurchase || !isCouponValid) {
                await Cart.updateOne(
                    { userId },
                    {
                        $unset: { appliedCoupon: 1 },
                        couponDiscount: 0,
                        totalAmount: total,
                    }
                );
                appliedCoupon = null;
            } else {
                couponDiscount = coupon.offerPrice;
                total -= couponDiscount;
            }
        }

        await Cart.updateOne(
            { userId },
            {
                totalAmount: total,
                offerDiscount,
                couponDiscount,
            }
        );

        const availableCoupons = coupons.filter((coupon) => {
            return !cart.items.some((item) => {
                const product = item.productId;
                if (!product) return false;
                return user.usedDiscounts.some((d) => d.productId.toString() === product._id.toString() && d.couponId && d.couponId.toString() === coupon._id.toString() );
            });
        });

        res.render("cart", {
            user,
            cartItems: enhancedCartItems,
            total,
            coupons: availableCoupons,
            appliedCoupon,
            offerDiscount,
            couponDiscount,
        });

    } catch (error) {

        console.error("Error in getCartPage:", error);
        res.redirect("/pageNotFound");
    }
};