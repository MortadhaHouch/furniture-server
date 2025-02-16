import fs from 'fs/promises';
import { Request, Response, Router } from "express";
import Category from "../models/Category";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();
import User from "../models/User"
import Product from "../models/Product"
import path from "path";
import { FileArray } from "express-fileupload";
const categoryController = Router();

categoryController.get("/:p?",async(req:Request,res:Response)=>{
    try {
        const {p} = req.params;
        const limit = 10;
        const skip = (parseInt(p) - 1) * limit;
        const categoriesCount = await Category.countDocuments();
        const categories = await Category.find().skip(skip).limit(limit);
        res.json({categories,page:p,pages:Math.ceil(categoriesCount/limit)})
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
                            const files= req.files;
                            if (files) {
                                console.log("File uploaded successfully");
                                const uploadPath = path.join(__dirname, `../uploads/categories/${name}`);
                                await fs.mkdir(uploadPath, { recursive: true });
                                const fileUploadPromises: Promise<void>[] = [];
                                for (const file of Object.values(files)) {
                                    if (Array.isArray(file)) {
                                        for (const f of file) {
                                            const filePath = path.join(uploadPath, f.name);
                                            fileUploadPromises.push(f.mv(filePath));
                                        }
                                    } else {
                                        const filePath = path.join(uploadPath, file.name);
                                        fileUploadPromises.push(file.mv(filePath));
                                    }
                                }
                                await Promise.all(fileUploadPromises);
                                newCategory.image = uploadPath;
                            }
                            await newCategory.save();
                            res.status(201).json({
                                message: "Category added successfully",
                                ok: true,
                                category: { name, description },
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
categoryController.get("/:id",async(req:Request,res:Response)=>{
    try {
        const {id} = req.params;
        const category = await Category.findById(id);
        res.json({category})
    } catch (error) {
        console.log(error);
    }
})

categoryController.put("/update-category/:id",async(req:Request,res:Response)=>{
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
                    const {name,description} = req.body;
                    const category = await Category.findByIdAndUpdate(id,{name,description});
                    res.status(201).json({message:"Category updated successfully"})
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

categoryController.get("/:id/products",async(req:Request,res:Response)=>{
    try {
        const {id} = req.params;
        const category = await Category.findById(id);
        if(category){
            const products = await Product.find({category});
            res.json({products})
        }else{
            res.status(404).json({message:"Category not found"})
        }
    } catch (error) {
        console.log(error);
    }
})

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
                    const category = await Category.findByIdAndDelete(id);
                    res.status(201).json({message:"Category deleted successfully"})
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