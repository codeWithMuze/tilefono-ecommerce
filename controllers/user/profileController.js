const User= require('../../models/userSchema')
const nodemailer=require('nodemailer')
const bcrypt= require('bcrypt')
const env= require('dotenv').config()
const session=require('express-session');
const Address= require('../../models/addressSchema')
const fs = require('fs');
const path = require('path');

function generateOtp(){
    const digits='1234567890'
    let otp=''
    for(let i=0;i<6;i++){
        otp += digits[Math.floor(Math.random()*10)]
    }
    return otp;
}

const getForgotPassPage= async (req,res)=>{
    try{
        res.render('forgot-password')
    } catch(error){
        res.redirect('/pageNotFound')
    }
};

const sendVerificationEmail= async (email,otp)=>{
    try{
        const transporter= nodemailer.createTransport({
            service:"gmail",
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD,

            }
        })

        const mailOptions={
            from:process.env.NODEMAILER_EMAIL,
            to:email,
            subject:"Your otp for password reset",
            text:'Your OTP is ${otp}',
            html:`<b><h4>Your OTP is :${otp}</h4></b>`
        }

        const info = await transporter.sendMail(mailOptions)
        console.log("email sent",info.messageId)
        return true
    } catch(error){
        console.error("error sending email",error)
        return false;
    }
}

const forgotEmailValid= async (req,res)=>{
    try{
        const{email}=req.body;
        const findUser= await User.findOne({email:email})
        if(findUser){
            const otp=generateOtp()
            const emailSent= await sendVerificationEmail(email,otp);

            if(emailSent){
                req.session.userOtp= otp;
                req.session.email=email;
                res.render('forgotPass-otp')
                 console.log('OTP',otp)
            } else{
                res.json({success:false , message:"Failed to sent otp.. Please try again" })
            }
        }else {
            res.render('profile', {
                user: userData,
                userAddress: userAddress
            });            
        }
    } catch(err){
        res.redirect('/pageNotFound')
    }
      
}

const userProfile=async(req,res)=>{
    try{
        const userId= req.session.user;
        const userData= await User.findById(userId)
        const addressData=await Address.findOne({userId:userId})
        

        let walletBalance = '0.00';
        if (userData.wallet) {

            if (typeof userData.wallet === 'number') {
                walletBalance = userData.wallet.toFixed(2);
            } 

            else if (userData.wallet.balance && typeof userData.wallet.balance === 'number') {
                walletBalance = userData.wallet.balance.toFixed(2);
            }

            else if (Array.isArray(userData.wallet) && userData.wallet.length > 0) {

                if (typeof userData.wallet[0] === 'number') {
                    walletBalance = userData.wallet[0].toFixed(2);
                }
            }
        }
        

        let walletTransactions = [];
        if (userData.walletHistory && Array.isArray(userData.walletHistory)) {
            walletTransactions = userData.walletHistory;
        }
        
        res.render('profile', {
            user: userData,
            userAddress: addressData,
            walletBalance: walletBalance,
            walletTransactions: walletTransactions
        });
        
    } catch(error){
        console.log('Error happened while opening profile data',error)
        res.redirect('/pageNotFound')
    }
};

const changeEmail= async(req,res)=>{
    try{
        res.render('changeEmail')
    } catch(err){
        res.redirect('/pageNotFound')
    }
};

const changeEmailValid = async (req, res) => {
    try {

        const { currentEmail } = req.body; 
        const userId = req.session.user; 




        const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailPattern.test(currentEmail)) {
            return res.render('changeEmail', { message: "Please enter a valid email address." });
        }

        
        
        const userExists = await User.findById(userId); 
        if (userExists.email !== currentEmail) {
            return res.render('changeEmail', {
                message: "Entered email doesn't match your profile email."
            });
        }

        if (userExists.email=== currentEmail ) {
            const otp = generateOtp();
            const emailSent = await sendVerificationEmail(currentEmail, otp);

            if (emailSent) {
                req.session.userOtp = otp;
                req.session.userData = req.body;   
                req.session.email = currentEmail;   

                res.render('change-email-otp');
                console.log("Email has been sent successfully");
                console.log("OTP:", otp);
            } else {
                res.render('changeEmail', { message: "Failed to send OTP. Please try again." });
            }
        } else {
            res.render('changeEmail', {
                message: "User with this email does not exist."
            });
        }
    } catch (err) {
        console.error("Error in changeEmailValid:", err);
        res.redirect('/pageNotFound');
    }
};


const   verifyEmailOtp = async (req, res) => {
    try {
        const enteredOtp = req.body.otp; 
        const sessionOtp = req.session.userOtp;

        if (enteredOtp === sessionOtp) {
            req.session.userData = req.session.userData || {};
            res.render('enter-new-email', { userData: req.session.userData });
            
        } else {
            res.render('change-email-otp', { message: "Invalid OTP. Please try again." ,
                userData: req.session.userData
            });
        }
    } catch (error) {
        console.error("Error in verifyEmailOtp:", error);
        res.redirect('/pageNotFound');
    }
};

const updateEmail= async (req,res)=>{
    try {
        const newEmail= req.body.newEmail;
        const userId= req.session.user;
        await User.findByIdAndUpdate(userId, { email: newEmail });
        res.redirect('/userProfile')
    } catch (error) {
        res.redirect('/pageNotFound')
    }
}

const changePassword= async (req,res)=>{
    try{
        res.render('change-password')
    } catch(err){
        res.redirect('/pageNotFound')
    }
}

const changePasswordValid= async (req,res)=>{
    try{
        const {currentEmail}= req.body;
        const userId = req.session.user; 

        
      

        const userExists=await User.findById(userId) 
        if (userExists.email !== currentEmail) {
            return res.render('change-password', {
                message: "Entered email doesn't match your profile email."
            });
        }

        if (userExists.email=== currentEmail ) {
            const otp = generateOtp();
            const emailSent = await sendVerificationEmail(currentEmail, otp);

            if (emailSent) {
                req.session.userOtp = otp;
                req.session.userData = req.body;   
                req.session.email = currentEmail;   

                res.render('change-password-otp');
                console.log("Email has been sent successfully");
                console.log("OTP:", otp);
            } else {
                res.render('change-password', { message: "Failed to send OTP. Please try again." });
            }
        } else {
            res.render('change-password', {
                message: "User with this email does not exist."
            });
        }

    }catch(error){
        console.log("error in generate otp :",error)
        res.redirect('/pageNotFound')
    }
};

const verifyPassOtp=async (req,res)=>{
    try {
        const enteredOtp = req.body.otp; 
        const sessionOtp = req.session.userOtp;

        if (enteredOtp === sessionOtp) {
            req.session.userData = req.session.userData || {};
            res.render('enter-new-password', { userData: req.session.userData });
            
        } else {
            res.render('change-password-otp', { message: "Invalid OTP. Please try again." ,
                userData: req.session.userData
            });
        }
    } catch (error) {
        console.error("Error in verifyPasswordOtp:", error);
        res.redirect('/pageNotFound');
    }
};

const updatePassword = async (req, res) => {
    try {
      const { email, newPassword, confirmPassword } = req.body;
  
      if (newPassword !== confirmPassword) {
        return res.json({
          success: false,
          message: "Passwords do not match."
        });
      }
  
      const user = await User.findOne({ email });
      if (!user) {
        return res.json({
          success: false,
          message: "User not found."
        });
      }
  
      const hashedPassword = await bcrypt.hash(newPassword, 10);
  
      user.password = hashedPassword;
      await user.save();
  
      return res.json({
        success: true,
        message: "Password updated successfully."
      });
    } catch (error) {
      console.error("Error updating password:", error);
      return res.json({
        success: false,
        message: "There was a problem updating your password. Please try again later."
      });
    }
  };
  
  const resendOtp = async (req, res) => {
    try {
      const { email } = req.body;
    
    } catch (error) {
      console.error("Error in resendOtp:", error);
      return res.json({ success: false, message: "Error occurred while resending OTP. Please try again." });
    }
  };
  

  const addAddress= async (req,res)=>{
    try{
        const user=req.session.user;
        res.render('add-address',{user:user})
    } catch(err){
        res.redirect('/pageNotFound')
    }
  };


  const postAddAddress = async (req, res) => {
    try {

        if (!req.session) {
            return res.json({ success: false, message: "Session not found!" });
        }

        const userId = req.session.user;
        if (!userId) {
            return res.json({ success: false, message: "User not logged in!" });
        }

        const userData = await User.findById(userId);
        if (!userData) {
            return res.json({ success: false, message: "User not found!" });
        }

        const { addressType, name, city, landmark, state, pincode, phone, altPhone } = req.body;

        let userAddress = await Address.findOne({ userId: userId });

        if (!userAddress) {
            userAddress = new Address({
                userId: userId,
                address: [{ addressType, name, city, landmark, state, pincode, phone, altPhone }]
            });
            await userAddress.save();
        } else {
            userAddress.address.push({ addressType, name, city, landmark, state, pincode, phone, altPhone });
            await userAddress.save();
        }

        res.json({ success: true, message: "Address added successfully!" });

    } catch (err) {
        console.error('❌ Error in postAddAddress:', err);
        res.json({ success: false, message: "Error saving address!" });
    }
};

const updateProfile = async (req, res) => {
    try {
        const { fullName, phone } = req.body;
        const userId = req.session.user;


        if (!fullName || !phone) {
            return res.json({
                success: false,
                message: "All fields are required"
            });
        }


        await User.findByIdAndUpdate(userId, {
            name: fullName,
            phone: phone
        });

        return res.json({
            success: true,
            message: "Profile updated successfully"
        });
    } catch (error) {
        console.error("Error updating profile:", error);
        return res.json({
            success: false,
            message: "There was a problem updating your profile. Please try again later."
        });
    }
};


const uploadProfilePicture = async (req, res) => {
    try {
        const userId = req.session.user._id;

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const profilePicPath = `/uploads/profile-pictures/${req.file.filename}`;

        // Update the user's profile picture in the database
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Delete the old profile picture if it exists
        if (user.profilePic) {
            const oldPicPath = path.join(__dirname, '../../public', user.profilePic);
            if (fs.existsSync(oldPicPath)) {
                fs.unlinkSync(oldPicPath);
            }
        }

        user.profilePic = profilePicPath;
        await user.save();

        req.session.user.profilePic = profilePicPath; // Update session data

        return res.status(200).json({ success: true, message: 'Profile picture updated successfully', profilePic: profilePicPath });
    } catch (error) {
        console.error('Error uploading profile picture:', error);
        return res.status(500).json({ success: false, message: 'Failed to upload profile picture' });
    }
};

const updateAddress = async (req, res) => {
    try {
        const { addressId, addressType, name, city, landmark, state, pincode, phone, altPhone } = req.body;
        const userId = req.session.user;


        const addressDoc = await Address.findOne({ userId: userId });
        
        if (!addressDoc) {
            return res.json({
                success: false,
                message: "Address not found"
            });
        }


        const addressIndex = addressDoc.address.findIndex(addr => addr._id.toString() === addressId);
        
        if (addressIndex === -1) {
            return res.json({
                success: false,
                message: "Address not found"
            });
        }


        addressDoc.address[addressIndex] = {
            ...addressDoc.address[addressIndex],
            addressType,
            name,
            city,
            landmark,
            state,
            pincode,
            phone,
            altPhone: altPhone || undefined
        };

        await addressDoc.save();

        return res.json({
            success: true,
            message: "Address updated successfully"
        });
    } catch (error) {
        console.error("Error updating address:", error);
        return res.json({
            success: false,
            message: "There was a problem updating your address. Please try again later."
        });
    }
};  

const removeProfilePicture = async (req, res) => {
    try {
        const userId = req.session.user._id;

        // Find the user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Remove the profile picture file if it exists
        if (user.profilePic) {
            const profilePicPath = path.join(__dirname, '../../public', user.profilePic);
            if (fs.existsSync(profilePicPath)) {
                fs.unlinkSync(profilePicPath);
            }
        }

        // Update the user's profile picture in the database
        user.profilePic = null;
        await user.save();

        req.session.user.profilePic = null; // Update session data

        return res.status(200).json({ success: true, message: 'Profile picture removed successfully' });
    } catch (error) {
        console.error('Error removing profile picture:', error);
        return res.status(500).json({ success: false, message: 'Failed to remove profile picture' });
    }
};

const uploadDP= async (req,res)=>{
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const userId = req.session.user_id;
        const profilePicPath = `/uploads/profile-pictures/${req.file.filename}`;

        await User.findByIdAndUpdate(userId, { profilePic: profilePicPath });

        res.json({ 
            success: true, 
            message: 'Profile picture updated successfully',
            profilePicUrl: profilePicPath
        });
    } catch (error) {
        console.error('Profile picture upload error:', error);
        res.status(500).json({ success: false, message: 'An error occurred. Please try again.' });
    }
}


const addMoneyToWallet = async (req, res) => {
    try {
        const { amount } = req.body;
        const userId = req.session.user;

        // Validate user session
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized: Please log in again.',
            });
        }

        // Convert amount to a number and validate
        const amountValue = parseFloat(amount);
        if (isNaN(amountValue) || amountValue <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid amount greater than zero.',
            });
        }

        // Optional: Add maximum amount validation (e.g., ₹50,000)
        if (amountValue > 50000) {
            return res.status(400).json({
                success: false,
                message: 'Amount cannot exceed ₹50,000.',
            });
        }

        // Find user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found.',
            });
        }

        // Initialize wallet if undefined
        if (typeof user.wallet !== 'number') {
            user.wallet = 0;
        }

        // Add amount to wallet
        user.wallet += amountValue;

        // Create transaction
        const transaction = {
            amount: amountValue,
            type: 'credit',
            description: 'Added to wallet',
            date: new Date(),
        };

        // Initialize wallet history if undefined
        if (!user.walletHistory) {
            user.walletHistory = [];
        }

        // Add transaction to history
        user.walletHistory.push(transaction);

        // Save user
        await user.save();

        // Return response
        return res.status(200).json({
            success: true,
            message: 'Amount added to wallet successfully.',
            walletBalance: user.wallet,
        });
    } catch (error) {
        console.error('Error adding money to wallet:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while adding money to wallet.',
        });
    }
};


const getWalletTransactions = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const user = await User.findById(userId);
        
        if (!user.wallet || !user.wallet.transactions) {
            return res.status(200).json({
                success: true,
                transactions: []
            });
        }
        

        const transactions = user.wallet.transactions.sort((a, b) => b.date - a.date);
        
        return res.status(200).json({
            success: true,
            transactions: transactions
        });
    } catch (error) {
        console.error('Error fetching wallet transactions:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred. Please try again.'
        });
    }
};


module.exports= {
    getForgotPassPage,
    forgotEmailValid,
    sendVerificationEmail,
    userProfile,
    changeEmail,
    changeEmailValid,
    verifyEmailOtp,
    updateEmail,
    changePassword,
    changePasswordValid,
    verifyPassOtp,
    updatePassword,
    resendOtp,
    addAddress,
    postAddAddress,
    updateProfile,
    updateAddress,uploadDP,
    addMoneyToWallet,
    getWalletTransactions,
    uploadProfilePicture,
    removeProfilePicture

}