    const User=require('../models/userSchema')


    const userAuth = async (req, res, next) => {
        try {
            if (!req.session.user) {
                if (req.xhr || req.headers.accept.includes('application/json')) {
                    return res.status(401).json({ 
                        success: false, 
                        message: 'Please login to continue' 
                    });
                }
                return res.redirect('/login');
            }
    
            const user = await User.findById(req.session.user._id);
            if (!user || user.isBlocked) {
                req.session.destroy(); // Clear invalid session
                if (req.xhr || req.headers.accept.includes('application/json')) {
                    return res.status(401).json({ 
                        success: false, 
                        message: 'Session expired. Please login again.' 
                    });
                }
                return res.redirect('/login');
            }
    
            req.user = user; // Attach user data to req object for later use
            next();
        } catch (error) {
            console.error('Error in user auth middleware:', error);
            if (req.xhr || req.headers.accept.includes('application/json')) {
                return res.status(500).json({ 
                    success: false, 
                    message: 'Internal server error' 
                });
            }
            res.status(500).send('Internal server error');
        }
    };
    

    const adminAuth=(req,res,next)=>{
        User.findOne({isAdmin:true})
        .then(data=>{
            if(data){
                next()
            }else{
                res.redirect('/admin/login')
            }
        })
        .catch(error=>{
            console.log('Error in admin auth middleware')
            res.status(500).send('Internal server error')
        })
    }

    module.exports={
        adminAuth,userAuth
    }