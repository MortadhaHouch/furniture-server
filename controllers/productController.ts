import {Router,Request,Response} from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();
import User from "../models/User"
import Product from "../models/Product"
import Card from "../models/Card";
import Category from "../models/Category";
import fileUpload, { FileArray } from "express-fileupload"
import path from "path";
import {v4} from "uuid"
const productController = Router();
productController.get("/stats",async(req:Request,res:Response)=>{
    try {
        const token = req.cookies.auth_token;
        console.log(req.url);
        if(token){
            const {email} = jwt.verify(token,process.env.SECRET_KEY as string) as {email:string};
            console.log(email);
            const user = await User.findOne({email});
            if(!user){
                res.status(401).json({message:"Unauthorized"})
            }else{
                console.log(user.firstName + " " + user.lastName);
                if(user.role === "ADMIN"){
                    const startOfDay = new Date().setHours(0, 0, 0, 0);
                    const endOfDay = new Date().setHours(23, 59, 59, 999);
                    const salesToday = await Product.countDocuments({
                        createdAt:new Date().getDay(),
                        "products.status":"COMPLETED"
                    });
                    const salesYesterday = await Product.countDocuments({
                        createdAt:new Date().getDay()-1,
                        "products.status":"COMPLETED"
                    });
                    const monthlySales = await Product.find({
                        "products.status":"COMPLETED"
                    })
                    const users = await User.find({
                        role:"USER"
                    })
                    const ongoingOrders = await Card.countDocuments({
                        "products.status":"PENDING"
                    });
                    const cancelledOrders = await Card.countDocuments({
                        "products.status":"CANCELLED"
                    });
                    const latestSales = await Card.find({
                        createdAt: { $gte: new Date(startOfDay), $lte: new Date(endOfDay) },
                    })
                    .sort({ createdAt: -1 })
                    .limit(10)
                    .populate("products");
                    const salesPerMonth = await Card.aggregate([
                        {
                            $match: { "products.status": "COMPLETED" },
                        },
                        {
                            $group: {
                                _id: { $month: "$createdAt" },
                                labels: { $sum: 1 },
                                date: { $first: "$createdAt" },
                            },
                        },
                        { $sort: { date: 1 } },
                    ]);
                    const userPerMonth = await User.aggregate([
                        {
                            $group: {
                                _id: { $month: "$createdAt" },
                                labels: { $sum: 1 },
                                month: { $first: "$createdAt" },
                            },
                        },
                        { $sort: { date: 1 } },
                    ]);
                    res.json({
                        isVerified:true,
                        salesToday,
                        salesYesterday,
                        orders:ongoingOrders,
                        cancelled:cancelledOrders,
                        users:userPerMonth.map((item)=>{return {date:new Date(item.month).toDateString(),labels:item.labels}}),
                        monthlySales:salesPerMonth.map((item)=>{return {date:new Date(item.month).toDateString(),labels:item.labels}}),
                        latestSales
                    })
                }else{
                    res.status(401).json({auth_message:"Unauthorized"})
                }
            }
        }else{
            res.status(401).json({auth_message:"Unauthorized"})
        }
    } catch (error) {
        console.log(error);
    }
})
productController.get("/latest-sales/:p?",async(req:Request,res:Response)=>{
    try {
        const auth_token = req.cookies.auth_token;
        if(auth_token){
            const {email} = jwt.verify(auth_token,process.env.SECRET_KEY as string) as {email:string};
            const user = await User.findOne({email});
            if(user){
                const startOfDay = new Date().setHours(0, 0, 0, 0);
                const endOfDay = new Date().setHours(23, 59, 59, 999);
                const {p} = req.params;
                const searchTasks = [];
                const pagesCount = await Card.countDocuments({ products: { $exists: true, $not: { $size: 0 } } });
                if(p && !isNaN(Number(p))){
                    const latestSales = Card.find({
                        createdAt: { $gte: new Date(startOfDay), $lte: new Date(endOfDay) },
                    })
                    .sort({ createdAt: -1 })
                    .skip((Number(p)-1)*10)
                    .limit(10)
                    .populate("products");
                    searchTasks.push(latestSales);
                }else{
                    const latestSales = Card.find({
                        createdAt: { $gte: new Date().setHours(0, 0, 0, 0) },
                    })
                    .sort({ createdAt: -1 })
                    .skip(0)
                    .limit(10)
                    .populate("products");
                    searchTasks.push(latestSales);
                }
                const latestSales = await Promise.all(searchTasks);
                const latestSalesFlattened = latestSales.flat();
                const usersIds = latestSalesFlattened.map((userId) => userId.user);
                const users = await User.find({ _id: { $in: usersIds } });
                const salesFormatted  = latestSalesFlattened.map((sale) => {
                    const user = users.find((user) => user._id.toString() === sale.user.toString());
                    return {
                        ...sale,
                        user: {
                            firstName: user?.firstName,
                            lastName: user?.lastName,
                        },
                    };
                })
                res.json({isVerified:true,sales:salesFormatted,pagesCount,page:Number(p)})
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
productController.get("/:status/:p?",async(req:Request,res:Response)=>{
    try {
        const auth_token = req.cookies.auth_token;
        if(auth_token){
            const {email} = jwt.verify(auth_token,process.env.SECRET_KEY as string) as {email:string};
            const user = await User.findOne({email});
            if(user){
                if(user.role === "ADMIN"){
                    const {status,p} = req.params;
                    const {category} = req.query;
                    const searchTasks = [];
                    const pagesCount = await Card.countDocuments({"products.status":status,"products.category":category||""});
                    if(p && !isNaN(Number(p))){
                        const latestSales = Card.find({"products.status":status,"products.category":category||""}).sort({createdAt: -1}).skip((Number(p)-1)*10).limit(10).populate("products");
                        searchTasks.push(latestSales);
                    }else{
                        const latestSales = Card.find({"products.status":status,"products.category":category||""}).sort({createdAt: -1}).skip(0).limit(10).populate("products");
                        searchTasks.push(latestSales);
                    }
                    const [latestSales] = await Promise.all(searchTasks);
                    const latestSalesFlattened = latestSales.flat();
                    const usersIds = latestSalesFlattened.map((userId) => userId.user);
                    const users = await User.find({ _id: { $in: usersIds } });
                    const salesFormatted  = latestSalesFlattened.map((sale) => {
                        const user = users.find((user) => user._id.toString() === sale.user.toString());
                        return {
                            ...sale,
                            user: {
                                firstName: user?.firstName,
                                lastName: user?.lastName,
                            },
                        };
                    })
                    res.json({isVerified:true,sales:salesFormatted,pagesCount,page:Number(p)})
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
productController.get("/:p?",async(req:Request,res:Response)=>{
    try {
        const {p} = req.params;
        const {category} = req.query;
        if(p && !isNaN(Number(p))){
            const products = await Product.find({category}).skip(Number(p)*10).limit(10)
            res.json({"products":products})
        }else{
            const products = await Product.find({category});
            res.json({"products":products})
        }
    } catch (error) {
        console.log(error);
    }
})
productController.get("/orders/:p?",async(req:Request,res:Response)=>{
    try {
        const token = req.cookies.auth_token;
        if(token){
            const {email} = jwt.verify(token,process.env.SECRET_KEY as string) as {email:string};
            console.log(email);
            const user = await User.findOne({email});
            if(!user){
                res.status(401).json({message:"Unauthorized"})
            }else{
                console.log(user.firstName + " " + user.lastName);
                if(user.role === "ADMIN"){
                    const {p} = req.params;
                    if(p && !isNaN(Number(p))){
                        // for (let index = 0; index < array.length; index++) {
                            
                        // }
                    }else{
                        // const products = await Product.find({category});
                        // res.json({"products":products})
                    }
                }else{
                    res.status(401).json({auth_message:"Unauthorized"})
                }
            }
        }else{
            res.status(401).json({auth_message:"Unauthorized"})
        }
    } catch (error) {
        console.log(error);
    }
})

productController.post("/add",async(req:Request,res:Response)=>{
    try{
        const token = req.cookies.auth_token;
        if(token){
            const {email} = jwt.verify(token,process.env.SECRET_KEY as string) as {email:string};
            const user = await User.findById({email});
            if(!user){
                res.status(401).json({message:"Unauthorized"})
            }else{
                if(user.role === "ADMIN"){
                    const {name,price,description,category} = req.body  as {name:string,price:string,description:string,category:string};
                    if(!name || !price || !description || !category){
                        res.status(400).json({keys_message:"Please provide all required fields"})
                    }
                    const product = new Product({name,price,description,category})
                    await product.save();
                    res.status(201).json({success_message:"Product added successfully"})
                }else{
                    res.status(401).json({auth_message:"Unauthorized"})
                }
            }
        }else{
            res.status(401).json({cred_message:"Unauthorized"})
        }
    }catch(e){
        console.log(e);
    }
})
productController.get("/:id",async(req:Request,res:Response)=>{
    try {
        const {id} = req.params
        const product = await Product.findById(id);
        if(product){
            const foundProduct = {
                name:product.name as string,
                price:product.price as number,
                description:product.description as string,
                category:product.category as string,
                images:product.images as string[],
                quantity:product.quantity as number,
                sold:product.sold as number,
            }
            res.json({product:foundProduct})
        }else{
            res.status(404).json({message:"Product not found"})
        }
    } catch (error) {
        console.log(error);
    }
})
productController.put("/:id",async(req:Request,res:Response)=>{
    try {
        const {id} = req.params;
        const token = req.cookies.auth_token;
        if(token){
            const {email} = jwt.verify(token,process.env.SECRET_KEY as string) as {email:string};
            const user = await User.findById({email});
            if(!user){
                res.status(401).json({auth_message:"Unauthorized"})
            }else{
                if(user.role === "ADMIN"){
                    const {name,price,description,category} = req.body  as {name:string,price:number,description:string,category:string};
                    const product = await Product.findByIdAndUpdate(id,{name,price,description,category})
                    res.json({success_message:"Product updated",product})
                }else{
                    res.status(401).json({auth_message:"Unauthorized"})
                }
            }
        }else{
            res.status(401).json({auth_message:"Unauthorized"})
        }
    } catch (error) {
        console.log(error);
    }
})
productController.post("/:id/images",async(req:Request,res:Response)=>{
    try {
        const token = req.cookies.auth_token;
        if(token){
            const {email} = jwt.verify(token,process.env.SECRET_KEY as string) as {email:string};
            const user = await User.findById({email});
            if(!user){
                res.status(401).json({auth_message:"Unauthorized"})
            }else{
                if(user.role === "ADMIN"){
                    const {id} = req.params;
                    const product = await Product.findById(id);
                    if(product){
                        const files = req.files as FileArray;
                        console.log(files);
                        // for (const f in Object.values(files)){
                        //     const ext = path.extname(f.originalname);
                        //     const fileName = `${v4()}${ext}`;
                        //     await f.mv(`uploads/${fileName}`);
                        //     product.images.push(`/${fileName}`);
                        // }
                        // await product.save();
                    }else{
                        res.status(404).json({message:"Product not found"})
                    }
                }else{
                    res.status(401).json({auth_message:"Unauthorized"})
                }
            }
        }else{
            res.status(401).json({auth_message:"Unauthorized"})
        }
    }catch(error){
        console.log(error);
    }
})
productController.delete("/:id",async(req:Request,res:Response)=>{
    try {
        const token = req.cookies.auth_token;
        if(token){
            const {email} = jwt.verify(token,process.env.SECRET_KEY as string) as {email:string};
            const user = await User.findById({email});
            if(!user){
                res.status(401).json({auth_error:"Unauthorized"})
            }else{
                if(user.role === "ADMIN"){
                    const {id} = req.params
                    const product = await Product.findByIdAndDelete(id)
                    res.json({success_message:"Product deleted"})
                }else{
                    res.status(401).json({auth_message:"Unauthorized"})
                }
            }
        }
    } catch (error) {
        console.log(error);
    }
})



export default productController;