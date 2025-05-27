const express=require('express')
const app=express()
const path=require('path')
require('dotenv').config()
const ejs=require('ejs')
const passport=require('./config/passport')
const session=require('express-session')
const userRouter=require('./routes/userRouter')
const adminRouter=require('./routes/adminRouter')
const flash = require("connect-flash");
const MongoStore = require('connect-mongo');


const db=require('./config/db');
// const { hyphenToCamel } = require('ejs/lib/utils');
db();   
 

app.use(express.json())
app.use(express.urlencoded({extended:true}));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: 'mongodb://127.0.0.1:27017/nodeProject',
      collectionName: 'sessions'
    }),
    cookie: {
      // secure: false,
      // httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24
        }
  }));


app.use(passport.initialize())
app.use(passport.session())



app.use((req,res,next)=>{
    res.set('cache-control','no-store')
    next()
})

app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

app.set('view engine','ejs')
const viewDirectories = [
    path.join(__dirname, 'views/user'),
    path.join(__dirname, 'views/admin')
  ];



app.set('views', viewDirectories)


app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
app.use('/product-images', express.static(path.join(__dirname, 'public', 'uploads', 'product-images')));


app.use("/",userRouter)
app.use('/admin',adminRouter)





const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>{
    console.log('SERVER IS STARTED TO RUN')
})

module.exports=app;