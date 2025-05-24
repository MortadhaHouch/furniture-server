import fs from 'fs';
import bcrypt from 'bcrypt';
import {Response, Router,Request} from "express"
import User from "../models/User";
const userController:Router = Router()
import jwt from "jsonwebtoken"
import Product from '../models/Product';
import Card from '../models/Card';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();
import { getContentType } from '../utils/getFileType';
userController.get("/stats", async (req: Request, res: Response): Promise<any> => {
    try {
        const auth_token = req.cookies.auth_token;
        if (!auth_token) {
            return res.status(401).json({ cred_message: "Unauthorized" });
        }else{
            const { email } = jwt.verify(auth_token, process.env.SECRET_KEY as string) as { email: string };
            const user = await User.findOne({ email });
            if (!user) {
                return res.status(401).json({ auth_message: "Not authorized" });
            }else{
                const userCart = await Card.findOne({ user: user._id });
                let ongoing: any[] = [];
                let completed: any[] = [];
                let cancelled: any[] = [];
                let savedProducts: any[] = [];
                if (userCart) {
                    const cartProducts = (await Product.find({ _id: { $in: userCart.products.map((item) => item.id) } }))
                        .map((product) => {
                            const currentProduct = userCart.products.find((item) => item.id.toString() === product._id.toString());
                            return {
                                _id: product._id,
                                name: product.name,
                                image: product.images,
                                price: product.price,
                                count: currentProduct?.count || 0,
                                category: product.category,
                                status: currentProduct?.status || "PENDING",
                                createdAt: currentProduct?.addedOn || new Date(),
                            };
                        });
                    ongoing = cartProducts.filter((product) => {
                        return userCart.products.some((item) => item.id.toString() === product._id.toString() && item.status === "PENDING");
                    });
                    completed = cartProducts.filter((product) => {
                        return userCart.products.some((item) => item.id.toString() === product._id.toString() && item.status === "COMPLETED");
                    });
                    cancelled = cartProducts.filter((product) => {
                        return userCart.products.some((item) => item.id.toString() === product._id.toString() && item.status === "CANCELLED");
                    });
                    const purchases = cartProducts
                        .filter((product) => {
                            return userCart.products.some((item) => 
                                item.id.toString() === product._id.toString() && item.status === "COMPLETED"
                            )
                        }).map((item) => {
                            return {
                                ...item,
                                id: item._id
                            }
                        });
                    return res.json({
                        user,
                        isVerified: true,
                        userStats: {
                            ongoing: ongoing.length,
                            completed: completed.length,
                            cancelled: cancelled.length,
                            savedProducts: savedProducts,
                            purchases
                        },
                    });
                }else{
                    return res.json({
                        user,
                        isVerified: true,
                        userStats: {
                            ongoing: ongoing.length,
                            completed: completed.length,
                            cancelled: cancelled.length,
                            savedProducts: savedProducts,
                            purchases:[]
                        },
                    });
                }
            }
        }

    } catch (error) {
        console.error("Error fetching user stats:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});


userController.get("/data",async(req,res)=>{
    try {
        const auth_token = req.cookies.auth_token;
        if(auth_token){
            const {email} = jwt.verify(auth_token,process.env.SECRET_KEY as string) as {email:string};
            const user = await User.findOne({email});
            if(user){
                res.json({
                    isVerified:true,
                    user:{
                        firstName:user.firstName,
                        lastName:user.lastName,
                        email:user.email,
                        role:user.role.toString(),
                        id:user._id.toString(),
                        avatar:user.avatar,
                        address:user.address,
                        phone:user.phone,
                        card:user.card,
                        savedProducts:user.savedProducts,
                        timestamps:{
                            createdAt:user.createdAt
                        },
                        isLoggedIn:user.isLoggedIn
                    }
                })
            }else{
                res.status(401).json({auth_message:"Unauthorized"})
            }
        }else{
            res.status(401).json({cred_message:"Unauthorized"})
        }
    } catch (error) {
        console.log(error);
    }
})
userController.get("/:id",async(req:Request, res:Response)=>{
    try {
        const auth_token = req.cookies["auth_token"]
        if(auth_token){
            const {email} = jwt.verify(auth_token,process.env.SECRET_KEY as string) as {email:string};
            const user = await User.findOne({email});
            if(user){
                if(['ADMIN','SUPER_ADMIN'].includes(user.role)){
                    const {id} = req.params;
                    const targetUser = await User.findById(id);
                    const userCard = await Card.findOne({user:user._id})
                    if(targetUser){
                        res.json({
                            isVerified:true,
                            user:{
                                firstName:targetUser.firstName,
                                lastName:targetUser.lastName,
                                email:targetUser.email,
                                role:targetUser.role.toString(),
                                id:targetUser._id.toString(),
                                avatar:targetUser.avatar,
                                address:targetUser.address,
                                phone:targetUser.phone,
                                card:userCard?.products.length||0,
                                timestamps:{
                                    createdAt:targetUser.createdAt
                                },
                                isLoggedIn:targetUser.isLoggedIn
                            }
                        }
                    )
                }else{
                    res.status(404).json({auth_message:"not found"})
                }
            }else{
                res.status(401).json({auth_message:"Unauthorized"})
            }
        }else{
            res.status(401).json({auth_message:"Unauthorized"})
        }
    }else{
        res.status(401).json({auth_message:"Unauthorized"})
    }
    } catch (error) {
        console.log(error);
    }
})
userController.get("/get-all/:p?", async (req: Request, res: Response) => {
    try {
        const auth_token = req.cookies.auth_token;
        if (!auth_token) {
            res.status(401).json({ auth_message: "Unauthorized" });
        }else{
            const { email } = jwt.verify(auth_token, process.env.SECRET_KEY as string) as { email: string };
            const user = await User.findOne({ email });
            if (!user) {
                res.status(401).json({ auth_message: "Unauthorized" });
            }else{
                const page = parseInt(req.params.p as string) || 1;
                const limit = 10;
                const offset = (page - 1) * limit;
                let query = {};
                if (["SUPER_ADMIN","ADMIN"].includes(user.role)) {
                    query = { role: { $in: ["USER", "ADMIN"] },_id:{$ne:user._id} };
                    const totalUsers = await User.countDocuments(query);
                    const paginatedUsers = await User.find(query).skip(offset).limit(limit);
                    res.json({
                        totalUsers,
                        currentPage: page,
                        totalPages: Math.ceil(totalUsers / limit),
                        isVerified: true,
                        users: paginatedUsers.map((el)=>{
                            return {
                                firstName:el.firstName,
                                lastName:el.lastName,
                                email:el.email,
                                role:el.role.toString(),
                                id:el._id.toString(),
                                avatar:el.avatar,
                                address:el.address,
                                phone:el.phone,
                                timestamps:{
                                    createdAt:el.createdAt
                                },
                                isLoggedIn:el.isLoggedIn
                            }
                        })
                    });
                } else {
                    res.status(401).json({ auth_message: "Unauthorized" });
                }
            }
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});
userController.get("/:userId/:avatar",async(req,res)=>{
    try{
        const {userId,avatar} = req.params;
        const user = await User.findById(userId);
        if(user){
            if(user.avatar){
                const filePath = path.join(__dirname,"../uploads","users",user.avatar);
                if(fs.existsSync(filePath)){
                    res.setHeader("Content-Type", getContentType(avatar));
                    res.setHeader("Content-Disposition", `attachment; filename=${path.basename(filePath)}`);
                    res.sendFile(filePath);
                }
            }else{
                res.status(404).json({message:"Not found"})
            }
        }else{
            res.status(404).json({message:"User not found"})
        }
    }catch(e){
        console.log(e);
    }
})
userController.post("/login",async(req:Request,res:Response)=>{
    try {
        const {email,password} = req.body ;
        if(!email ||!password){
            res.status(400).json({message:"Please provide email and password"})
        }
        const user = await User.findOne({email})
        if(user){
            const isMatch = await bcrypt.compare(password,user.password);
            if(isMatch){
                const token = jwt.sign({
                    id:user._id,
                    email:user.email,
                    firstName:user.firstName,
                    lastName:user.lastName,
                    role:user.role
                },process.env.SECRET_KEY as string,{
                    expiresIn:60*60*24*7
                })
                user.isLoggedIn = true;
                await user.save();
                res.json({token,isVerified:true})
            }else{
                res.status(401).json({cred_message:"Invalid credentials"})
            }
        }else{
            res.status(404).json({user_message:"User not found"})
        }
    } catch (error) {
        console.log(error);
    }
})

userController.post("/signup",async(req:Request,res:Response)=>{
    try {
        const {email,password,firstName,lastName} = req.body ;
        if(!email || !password || !firstName || !lastName){
            res.status(400).json({field_error:"S'il vous plaît remplissez tous les champs"})
        }
        const existingUser = await User.findOne({email});
        if(existingUser){
            res.status(409).json({user_error:"user with these credentials already exists"})
        }else{
            const role = email === process.env.SUPER_ADMIN_EMAIL as string ?"SUPER_ADMIN":"USER";
            const newUser = new User({email,password,firstName,lastName,role});
            await newUser.save()
            const token = jwt.sign({
                id:newUser._id,
                email:newUser.email,
                firstName:newUser.firstName,
                lastName:newUser.lastName,
                role
            },process.env.SECRET_KEY as string,{expiresIn:60*60*24*7})
            newUser.isLoggedIn = true;
            await newUser.save();
            res.status(201).json({token,isVerified:true})
        }
    } catch (error) {
        console.log(error);
    }
})
userController.post("/add-email",async(req:Request,res:Response)=>{
    try {
        const auth_token = req.cookies.access_token;
        if(!auth_token){
            res.status(401).json({auth_message:"Unauthorized"})
        }else{
            const {email} = jwt.verify(auth_token,process.env.SECRET_KEY as string) as {email:string};
            const user = await User.findOne({email});
            if(!user){
                res.status(401).json({auth_message:"Unauthorized"})
            }else{
                const {secondaryEmail} = req.body;
                const existingUser = await User.findOne({secondaryEmail});
                if(existingUser){
                    res.status(409).json({message:"Email already exists"})
                }else{
                    user.secondaryEmail = secondaryEmail;
                    await user.save();
                    res.status(201).json({message:"Email added successfully"})
                }
            }
        }
    } catch (error) {
        console.log(error);
    }
})
userController.post("/change-password",async(req:Request,res:Response)=>{
    try {
        const auth_token = req.cookies.access_token;
        if(!auth_token){
            res.status(401).json({auth_message:"Unauthorized"})
        }else{
            const {email} = jwt.verify(auth_token,process.env.SECRET_KEY as string) as {email:string};
            const user = await User.findOne({email});
            if(!user){
                res.status(401).json({auth_message:"Unauthorized"})
            }else{
                const {oldPassword,newPassword} = req.body;
                const isMatch = await bcrypt.compare(oldPassword,user.password);
                if(!isMatch){
                    res.status(401).json({auth_message:"Unauthorized"})
                }else{
                    user.password = newPassword;
                    await user.save();
                    res.status(201).json({message:"Password changed successfully"})
                }
            }
        }
    } catch (error) {
        console.log(error);
    }
})
userController.post("/add-admin",async(req:Request,res:Response)=>{
    try {
        const auth_token = req.cookies.access_token;
        if(!auth_token){    
            res.status(401).json({auth_message:"Unauthorized"})
        }else{
            const {email} = jwt.verify(auth_token,process.env.SECRET_KEY as string) as {email:string};
            const user = await User.findOne({email});
            if(!user){
                res.status(401).json({auth_message:"Unauthorized"})
            }else{
                if(user.role === "ADMIN" || user.role === "SUPER_ADMIN"){
                    const {email} = req.body;
                    const existingUser = await User.findOne({email});
                    if(existingUser){
                        existingUser.role = "ADMIN";
                        await existingUser.save();
                        res.status(201).json({message:"Admin added successfully"})
                    }else{
                        res.status(404).json({message:"User not found"})
                    }
                }else{
                    res.status(401).json({auth_message:"Unauthorized"})
                }
            }
        }
    } catch (error) {
        console.log(error);
    }
})
userController.put("/update-profile",async(req:Request,res:Response)=>{
    try {
        const auth_token = req.cookies.auth_token;
        if(!auth_token){
            res.status(401).json({auth_message:"Unauthorized"})
        }else{
            const {email} = jwt.verify(auth_token,process.env.SECRET_KEY as string) as {email:string};
            const user = await User.findOne({email});
            if(user){
                if(user){
                    const existingUser = await User.findOne({$or:[{secondaryEmail:req.body.secondaryEmail},{email:req.body.secondaryEmail}]});
                    if(existingUser){
                        res.status(409).json({message:"Email already exists"})
                    }else{
                        user.secondaryEmail = req.body.secondaryEmail;
                        if (req.body.password) {
                            user.password =  req.body.password;
                            user.markModified("password");
                        }
                        Object.entries(req.body).forEach(([key, value]) => {
                            if (key !== "password") {
                                (user as any)[key] = value;
                            }
                        });
                        await user.save();
                        res.status(201).json({ok:true,firstName:user.firstName,lastName:user.lastName,email:user.email})
                    }
                }else{
                    res.status(401).json({auth_message:"Unauthorized"})
                }
            }else{
                res.status(401).json({auth_message:"Unauthorized"})
            }
        }
    } catch (error) {
        console.log(error);
    }
})
userController.post("/logout",async(req:Request,res:Response)=>{
    try {
        const auth_token = req.cookies.auth_token;
        console.log(auth_token);
        if(auth_token){
            const {email} = jwt.verify(auth_token,process.env.SECRET_KEY as string) as {email:string};
            const user = await User.findOne({email});
            if(user){
                user.isLoggedIn = false;
                await user.save();
                res.json({logout_message:"User logged out successfully"})
            }else{
                res.status(401).json({user_message:"User not found"})
            }
        }else{
            res.status(401).json({auth_message:"Unauthorized"})
        }
    } catch (error) {
        console.log(error);
    }
})
export default userController;