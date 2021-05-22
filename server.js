const app = require('./app')

const connectDatabase = require('./config/database')


const path = require('path')

const dotenv = require('dotenv');
const cloudinary = require('cloudinary');

//Handle the Uncaught Exception
process.on('uncaughtException', err=>{
    console.log(`Error: ${err.stack}`);
    console.log(`Shutting server due to Uncaught Exception`);
    process.exit(1)
})



// setting up config file
dotenv.config({path: 'backend/config/config.env'})


//connecting to database
connectDatabase();

//setting up cloudinary configuration

cloudinary.config({
    cloud_name :  process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_NAME,
    api_secret: process.env.CLOUDINARY_API_SECRET
})



const server = app.listen(process.env.PORT, () => {
    console.log(`Server started on PORT: ${process.env.PORT} in ${process.env.NODE_ENV} mode`)
}) 


//Handle Unhandled Promise Rejections
process.on('unhandledRejection', err=>{
    console.log(`Error: ${err.message}`);
    console.log(`Shutting down server due to Unhandled Promise rejection`);
    server.close(()=>{
        process.exit(1);
    })
})