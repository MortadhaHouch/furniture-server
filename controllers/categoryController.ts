import fs from 'fs';
import { Request, Response, Router } from "express";
import Category from "../models/Category";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();
import User from "../models/User"
import Product from "../models/Product"
import path from "path";
import { FileArray } from "express-fileupload";
import { v4 } from 'uuid';
const categoryController = Router();
import { getContentType } from '../utils/getFileType';
categoryController.get("/:p?",async(req:Request,res:Response)=>{
    try {
        const {p} = req.params;
        const limit = 10;
        const skip = (parseInt(p) - 1) * limit;
        const categoriesCount = await Category.countDocuments();
        const categories = await Category.find().skip(skip).limit(limit);
        res.json({
            categories:categories.map((c)=>{
                return{
                    createdAt:c.createdAt,
                    name:c.name,
                    id:c._id,
                    description:c.description,
                    image:c.image,
                    updatedAt:c.updatedAt,
                    products:c.products
                }
            }),
            page:Number(p),
            pages:Math.ceil(categoriesCount/limit),
            ok:true
        })
    } catch (error) {
        console.log(error);
    }
})
categoryController.get("/by-id/:id",async(req:Request,res:Response)=>{
    try {
        const {id} = req.params;
        const category = await Category.findById(id);
        if(category){
            res.json({category:{...category,id:category._id}})
        }else{
            res.status(404).json({message:"Category not found"})
        }
    } catch (error) {
        console.log(error);
    }
})
categoryController.get("/product/:category/:file_path", async (req: Request, res: Response) => {
    try {
        const { file_path,category } = req.params;
        console.log(file_path);
        const filePath = path.join(__dirname, "../uploads/categories",category, file_path);
        if (!fs.existsSync(filePath)) {
            res.status(404).json({ message: "File not found" });
        }else{
            res.setHeader("Content-Type", getContentType(file_path));
            res.setHeader("Content-Disposition", `attachment; filename=${path.basename(filePath)}`);
            res.sendFile(filePath);
        }
    } catch (error) {
        console.error("Error serving file:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


categoryController.get("/:category/products/:p?",async(req:Request,res:Response)=>{
    try {
        const {category,p} = req.params;
        const foundCategory = await Category.find({name:category});
        if(foundCategory){
            const limit = 10;
            const productsCount = await Product.countDocuments({category});
            if(p && !isNaN(Number(p))){
                const skip = (parseInt(p) - 1) * limit;
                const products = await Product.find({category}).skip(skip).limit(limit);
                res.json({
                    products:products.map((item)=>{return {
                        name:item.name,
                        price:item.price,
                        description:item.description,
                        category:item.category,
                        images:item.images,
                        quantity:item.quantity,
                        sold:item.sold,
                        reviews:item.reviews,
                        reviewers:item.reviewers,
                        id:item._id,
                        createdAt:item.createdAt,
                    }}),
                    pages:Math.ceil(productsCount/limit)
                })
            }else{
                const products = await Product.find({category});
                res.json({
                    products:products.map((item)=>{return {
                        name:item.name,
                        price:item.price,
                        description:item.description,
                        category:item.category,
                        images:item.images,
                        quantity:item.quantity,
                        sold:item.sold,
                        reviews:item.reviews,
                        reviewers:item.reviewers,
                        id:item._id,
                        createdAt:item.createdAt,
                    }}),
                    pages:Math.ceil(productsCount/limit)
                })
            }
        }else{
            res.status(404).json({message:"Category not found"})
        }
    } catch (error) {
        console.log(error);
    }
})
categoryController.post("/add-category", async (req: Request, res: Response) => {
    try {
        const token = req.cookies.auth_token;
        if (token) {
            const { email } = jwt.verify(token, process.env.SECRET_KEY as string) as { email: string };
            const user = await User.findOne({ email });
            if (user) {
                if (["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
                    const { name, description } = req.body;
                    if (!name || !description) {
                        res.status(400).json({ message: "Name and description are required" });
                    }else{
                        const existingCategory = await Category.findOne({ name });
                        if (existingCategory) {
                            console.log("Category already exists");
                            res.status(409).json({ message: "Category already exists" });
                        }else{
                            console.log("Category added successfully");
                            const newCategory = new Category({ name, description });
                            let files: FileArray | undefined = req.files ?? undefined;
                            if (files) {
                                const uploadDir = path.join(__dirname, "../uploads/categories/", newCategory.name);
                                fs.mkdirSync(uploadDir, { recursive: true });
                                const file = Array.isArray(files) ? files[0] : Object.values(files)[0];
                                if (file) {
                                    try {
                                        const filename = v4() + path.extname(file.name)
                                        const filePath = path.join(uploadDir,filename);
                                        await new Promise<void>((resolve, reject) => {
                                            file.mv(filePath, (err: Error) => {
                                                if (err) {
                                                    console.error("File upload error:", err);
                                                    reject(err);
                                                } else {
                                                    resolve();
                                                }
                                            });
                                        });
                                        console.log(fs.existsSync(path.join(uploadDir,filename)))
                                        if (fs.existsSync(path.join(uploadDir,filename))) {
                                            newCategory.image = filename;
                                        }
                                    } catch (err) {
                                        console.error("Error in file upload:", err);
                                    }
                                }
                            }
                            await newCategory.save();
                            res.status(201).json({
                                message: "Category added successfully",
                                ok: true,
                                category: { name, description,image:newCategory.image||"" },
                            });
                        }
                    }
                }else{
                    res.status(401).json({ auth_message: "Unauthorized" });
                }
            }else{
                res.status(401).json({ message: "Unauthorized" });
            }
        }else{
            res.status(401).json({ cred_message: "Unauthorized" });
        }
    } catch (error) {
        console.error("Error in add-category route:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});
categoryController.post("/:id/add-product",async(req:Request,res:Response)=>{
    try {
        const {id} = req.params;
        const {productId} = req.body;
        const category = await Category.findById(id);
        const token = req.cookies.auth_token;
        if(token){
            const {email} = jwt.verify(token,process.env.SECRET_KEY as string) as {email:string};
            const user = await User.findOne({email});
            if(user){
                if(["ADMIN","SUPER_ADMIN"].includes(user.role)){
                    if(category){
                        const product = await Product.findById(productId);
                        if(product){
                            category.products.push(product._id);
                            await category.save();
                            res.status(201).json({message:"Product added to category successfully"})
                        }else{
                            res.status(404).json({message:"Product not found"})
                        }
                    }else{
                        res.status(404).json({message:"Category not found"})
                    }
                }else{
                    res.status(401).json({auth_message:"Unauthorized"})
                }
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
categoryController.delete("/delete-category/:id",async(req:Request,res:Response)=>{
    try {
        const token = req.cookies.auth_token;
        if(token){
            const {email} = jwt.verify(token,process.env.SECRET_KEY as string) as {email:string};
            const user = await User.findOne({email});
            if(!user){
                res.status(401).json({message:"Unauthorized"})
            }else{
                if(["ADMIN","SUPER_ADMIN"].includes(user.role)){
                    const {id} = req.params;
                    const category = await Category.findById(id);
                    if(category){
                        const uploadDir = path.join(__dirname, "../uploads/categories/", category.name);
                        if (fs.existsSync(uploadDir)) {
                            fs.rmSync(uploadDir, { recursive: true, force: true });
                        }
                        await category.deleteOne();
                    }
                    res.status(201).json({message:"Category deleted successfully",id})
                }else{
                    res.status(401).json({auth_message:"Unauthorized"})
                }
            }
        }else{
            res.status(401).json({cred_message:"Unauthorized"})
        }
    } catch (error) {
        console.log(error);
    }
})
export default categoryController