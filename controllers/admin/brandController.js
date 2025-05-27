    const Brand=require("../../models/brandSchema")
    const Product=require('../../models/productSchema')

    const getBrandPage = async (req,res)=>{
        try{
            const page= parseInt(req.query.page) || 1;
            const limit=4;
            const skip=(page-1)*limit;
            const brandData= await Brand.find({}).sort({createdAt:-1}).skip(skip).limit(limit)
            const totalBrands= await Brand.countDocuments();
            const totalPages= Math.ceil(totalBrands/limit)
            const reverseBrand= brandData.reverse();

            const blockedBrands = await Brand.countDocuments({ isBlocked: true });
            const activeBrands = totalBrands - blockedBrands;
            res.render("brands",{
                pageTitle: "Brand Management",
                data:reverseBrand,
                currentPage:page,
                totalPages:totalPages,
                totalBrands:totalBrands,
                blockedBrands,activeBrands
            })
        } catch(error){
            res.redirect('/pageError')
        }
    };

    const addBrand = async (req, res) => {
        try {
          const { name } = req.body; 
          const imageFile = req.file;
      
          if (!name) {
            return res.status(400).json({ error: "Brand Name is required" });
          }
      
          const newBrand = new Brand({ 
            brandName: name, 
            brandImage: imageFile ? imageFile.filename : null 
          });
          await newBrand.save();
      
          res.json({ 
            success:true,
            message: "Brand added successfully!",
            brand: newBrand
          });
        } catch (error) {
          console.error(error);
          res.status(500).json({ error: "Server error" });
        }
      };
      
      const blockBrand= async (req,res)=>{
        try{
            const id= req.query.id;
            await Brand.updateOne({_id:id},{$set:{isBlocked:true}})
            res.redirect('/admin/brands')
        } catch(err){
            res.redirect('/pageError')
        }
      };

      const unBlockBrand= async (req,res)=>{
        try{
            const id=req.query.id;
            await Brand.updateOne({_id:id},{$set:{isBlocked:false}})
            res.redirect("/admin/brands")
        } catch( error){
            res.redirect("/pageError")
        }
      };

      const deleteBrand= async (req,res)=>{
        try{
            const {id}= req.query;
            if(!id){
                return res.status(400).redirect('/pageError')
            }
            await Brand.deleteOne({_id:id})
            res.redirect('/admin/brands')
        } catch(error){
            console.log('Error deleting the brand', error)
            res.status(500).redirect('/pageError')
        }
      }
      


    module.exports={
        getBrandPage,addBrand,
        blockBrand,
        unBlockBrand,
        deleteBrand
    }