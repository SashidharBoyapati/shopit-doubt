const  User = require('../models/user');

const ErrorHandler = require('../utils/errorHandler');
const catchAsyncErrors = require('../middlewares/catchAsyncErrors');

const sendToken = require('../utils/jwtToken');
const sendEmail = require('../utils/sendEmail');

const crypto= require('crypto');

const cloudinary = require('cloudinary');

//Registering a user /api/v1/register

exports.registerUser = catchAsyncErrors( async (req,res,next) => {
   
    
    const result = await cloudinary.v2.uploader.upload( req.body.avatar , {
        folder: "avatars",
        width: 150,
        crop: "scale"
    })
    
    const {name,email,password} = req.body;

    const user = await User.create({
        name,
        email,
        password,
        avatar: {
            public_id: result.public_id,
            url: result.secure_url
        }
        //  avatar: {
        //      public_id: 'avatars/sashi_twmu0s',
        //      url: 'https://res.cloudinary.com/df9oqb1mh/image/upload/v1621662103/avatars/sashi_twmu0s.jpg'
        // }
    })


   sendToken(user, 200 , res)
})


//Login user => /api/v1/login

exports.loginUser = catchAsyncErrors( async(req,res,next) =>{
    
    const { email, password} = req.body;

    //Check if email and password is entered by user

    if(!email || !password){
        return next(new ErrorHandler('Please enter email & password',404));
    }

    //Finding the user in database

    const user = await User.findOne({email}).select('+password')

    if(!user){
        return next(new ErrorHandler('Invalid Email or Password',401));//401 unatenticated pwd
    }

    const isPasswordMatched = await user.comparePassword(password);

    if(!isPasswordMatched){
        return next(new ErrorHandler('Invalid Email or Password',401));
   
    }

    sendToken(user,200,res)
})


//Forgot password => api/v1/password/forgot

exports.forgotPassword = catchAsyncErrors(async(req,res,next) =>{
    
    const user = await User.findOne({email: req.body.email});
    if(!user)
    {
        return next(new ErrorHandler('User not found with this email',404))
    }
    //Get reset Token

    const resetToken = user.getResetPasswordToken();

    await user.save({validateBeforeSave: false})

    //create reser password url

    const resetUrl = `${req.protocol}://${req.get('host')}/api/v1/password/reset/${resetToken}`;

    const message = `Your password reset token is as follow:\n\n${resetUrl}\n\n If you have not requested this email, then ignore it.`

    try{
            await sendEmail({
                email: user.email,
                subject: `EShop password recovery email`,
                message
            })
            res.status(200).json({
                success: true,
                message: `Email sent to ${user.email}`
            })
    }catch(error){

        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save({validateBeforeSave: false})

        return next(new ErrorHandler(error.message, 500))
        

    }
})


//reset password => api/v1/password/reset/:token

exports.resetPassword = catchAsyncErrors(async(req,res,next) =>{

    //Hash Url token

    const resetPasswordToken = crypto.createHash('sha256').update(req.params.token).digest('hex')

    const user = await User.findOne({
        resetPasswordToken,
        resetPasswordExpire: {$gt: Date.now()}
    })
    if(!user)
    {
        return next(new ErrorHandler('Passoword reset token is invalid or has been expired',400))
    }

    if(req.body.password !== req.body.confirmPassword){
        return next(new ErrorHandler('Password does not match', 400))
    }

    //Setup new password
    user.password = req.body.password;

    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();
    
    sendToken(user,200,res);
})

//Get Currently logged in user details => api/v1/me

exports.getUserProfile = catchAsyncErrors(async(req,res,next)=>{
    const user = await User.findById(req.user.id);

    res.status(200).json({
        success: true,
        user
    })
})

// Update / Change password => api/v1/password/update
exports.updatePassword = catchAsyncErrors(async(req,res,next)=>{
    const user = await User.findById(req.user.id).select('+password');

    //check the previous user password

    const isMatched = await user.comparePassword(req.body.oldPassword)
    if(!isMatched)
    {
        return next(new ErrorHandler('Old password is incorrect'));
    }
     user.password = req.body.password;

     await user.save();

     sendToken(user,200,res);
})

// update user profile => /api/v1/me/update

exports.updateProfile = catchAsyncErrors(async(req,res,next) =>{
    const newUserData = {
        name:  req.body.name,
        email: req.body.email
    }

    //Update avatar : TODO

    const user = await User.findByIdAndUpdate(req.body.id, newUserData,{
        new: true,
        runValidators: true,
        useFindAndModify: false
    })

    res.status(200).json({
        success: true
    })

})



//Logout user => /api/v1/logout

exports.logout = catchAsyncErrors(async(req,res,next)=>{
    res.cookie('token',null,{
        expires: new Date(Date.now()),
        httpOnly:true
    })

    res.status(200).json({
        success: true,
        message: 'Logged out'
    })
})



//Admin Routes

//Get All the users => /api/v1/admin/users

exports.allUsers = catchAsyncErrors(async(req,res,next)=>{
    const users = await User.find();

    res.status(200).json({
        success: true,
        users
    })
})

//Get user details (specific user) => api/v1/admin/user/:id

exports.getUserdetails = catchAsyncErrors(async(req,res,next)=>{
    const user = await User.findById(req.params.id);

    if(!user)
    {
        return next(new ErrorHandler(`User not found with id: ${req.params.id}`))
    }

    res.status(200).json({
        success: true,
        user
    })
})

// Update user profile by admin => /api/v1/admin/user/:id


exports.updateUser = catchAsyncErrors(async(req,res,next) =>{
    const newUserData = {
        name:  req.body.name,
        email: req.body.email,
        role: req.body.role
    }

    //Update avatar : TODO

    const user = await User.findByIdAndUpdate(req.params.id, newUserData,{
        new: true,
        runValidators: true,
        useFindAndModify: false
    })

    res.status(200).json({
        success: true
    })

})


//Delete User by Admin => /api/v1/admin/user/:id

exports.deleteUser = catchAsyncErrors(async(req,res,next)=>{
    const user = await User.findById(req.params.id);

    if(!user)
    {
        return next(new ErrorHandler(`User not found with id: ${req.params.id}`))
    }

    // Remove avatar from cloudinary -todo

    await user.remove();
    res.status(200).json({
        success: true,
        user
    })
})
