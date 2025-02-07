import bcrypt from 'bcrypt';
import {Response, Router,Request} from "express"
import User from "../models/User";
const userController:Router = Router()
import jwt from "jsonwebtoken"
userController.post("/login",async(req:Request,res:Response)=>{
    try {
        const {email,password} = req.body ;
        if(!email ||!password){
            res.status(400).json({message:"Please provide email and password"})
        }
        const user = await User.findOne({email})
        if(user){
            const isMatch = await bcrypt.compare(password,user.password)
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
                res.json({token})
            }else{
                res.status(401).json({message:"Invalid credentials"})
            }
        }
    } catch (error) {
        console.log(error);
    }
})

userController.post("/register",async(req:Request,res:Response)=>{
    try {
        const {email,password,firstName,lastName,role} = req.body ;
        if(!email || !password || !firstName || !lastName || !role){
            res.status(400).json({message:"Please provide all required fields"})
        }
        const existingUser = await User.findOne({email})
        if(existingUser){
            res.status(409).json({message:"Email already exists"})
        }
        const newUser = new User({email,password,firstName,lastName,role})
        await newUser.save()
        res.status(201).json({message:"User registered successfully"})
    } catch (error) {
        console.log(error);
    }
})