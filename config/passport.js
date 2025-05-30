const passport= require("passport")
const GoogleStrategy=require('passport-google-oauth20').Strategy
const User=require("../models/userSchema")
const env= require('dotenv').config()
const Counter=require('../models/counterSchema')
const referral= require('../utils/referralCodeGenerator')



passport.use(new GoogleStrategy(
    {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: 'http://localhost:4000/auth/google/callback', 
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            let user = await User.findOne({ googleId: profile.id });
            if (user) {
                if (user.isBlocked) {
                    return done(null, false, { message: 'Your account is blocked.' });
                }
                return done(null, user);
            } else {
                // Generate customerID using your Counter model
                const counter = await Counter.findOneAndUpdate(
                    { name: 'customerID' },
                    { $inc: { seq: 1 } },
                    { new: true, upsert: true }
                );
                const customerID = counter.seq.toString().padStart(6, '0');

                const referralCode = referral(profile.displayName);
                // Check if the referral code already exists


                // Create new user with customerID
                user = new User({
                    name: profile.displayName,
                    email: profile.emails[0].value,
                    googleId: profile.id,
                    customerID: customerID,
                    referralCode: referralCode,
                });
                await user.save();
                return done(null, user);
            }
        } catch (error) {
            return done(error, null);
        }
    }
));






passport.serializeUser((user, done) => {
    done(null, user.id);
});


passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
})
module.exports=passport