const Banner=require('../../models/bannerSchema')
const path= require('path')
const fs= require('fs')
 
const getBannerPage= async (req,res)=>{
    try{
        const findBanner= await Banner.find({})
        res.render('banner',{
            data:findBanner,
            pageTitle:"Banner Management"
        })

    }catch(err){
        res.redirect('/pageError')

    }
};

const getAddBannerPage= async (req,res)=>{
    try{
        res.render('addBanner',{
            pageTitle:'Banner Management'
        })

    }catch (error){
        res.redirect('/pageError')
    }
}

const addBanner = async (req, res) => {
    try {
        console.log('req.file:', req.file);
        console.log('req.body:', req.body);

        const data = req.body;
        const image = req.file;
        const newBanner = new Banner({
            image: image.filename,
            title: data.title,
            description: data.description,
            startDate: new Date(data.startDate + 'T00:00:00'),
            endDate: new Date(data.enddate + 'T00:00:00'),  // use data.enddate to match req.body
            link: data.link
        });

        const savedBanner = await newBanner.save();
        console.log("New Banner Saved:", savedBanner);
        res.redirect('/admin/banner');
    } catch (error) {
        console.error("Error in addBanner:", error);
        res.redirect('/admin/pageError');
    }
};

const deleteBanner = async (req, res) => {
    try {
        const id = req.query.id;

        // Check if the banner exists before attempting to delete
        const banner = await Banner.findById(id);
        if (!banner) {
            console.log('Banner not found.');
            return res.redirect('/admin/banner');  // Or show a user-friendly error page
        }

        // Delete the banner image from the filesystem
        const imagePath = path.join(__dirname, `../../public/uploads/product-images/${banner.image}`);
        fs.unlink(imagePath, (err) => {
            if (err) console.error('Error deleting image:', err);
        });

        // Delete the banner document
        await Banner.deleteOne({ _id: id });

        return res.redirect('/admin/banner');
    } catch (error) {
        console.error('Error in deleteBanner:', error);
        res.redirect('/admin/pageError');
    }
};
    

module.exports= {
    getBannerPage,getAddBannerPage,addBanner
,deleteBanner}