import {Request,Response,Router} from "express"
import Message from "../models/Message"
import User from "../models/User"
import jwt from "jsonwebtoken";
import { Schema } from "mongoose";
const messageRouter:Router = Router();
messageRouter.get("/:p?",async(req:Request,res:Response)=>{
    try {
        const auth_token = req.cookies.auth_token;
        if(auth_token){
            const {email} = jwt.verify(auth_token, process.env.SECRET_KEY as string) as {email:string};
            const user = await User.findOne({email});
            if(user){
                const messageTasks = [];
                const {p} = req.params;
                const messagesCount = await Message.countDocuments({$or:[{sender:user._id},{receiver:user._id}]})
                if(p && !isNaN(Number(p))){
                    const messages = Message.find({$or:[{sender:user._id},{receiver:user._id}]}).skip((Number(p)-1)*10).limit(10);
                    messageTasks.push(messages);
                }else{
                    const messages = Message.find({$or:[{sender:user._id},{receiver:user._id}]});
                    messageTasks.push(messages);
                }
                const [messages] = await Promise.all(messageTasks);
                res.json({messages,isVerified:true,pages:Math.ceil(messagesCount/10),page:p});
            }else{
                res.status(401).json({auth_message:"unauthorized"});
            }
        }else{
            res.status(401).json({auth_message:"unauthorized"});
        }
    } catch (error) {
        console.log(error);
    }
})

messageRouter.post("/add",async(req:Request,res:Response)=>{
    try {
        const auth_token = req.cookies.auth_token
        if(auth_token){
            const {email} = jwt.verify(auth_token,process.env.SECRET_KEY  as string) as {email:string};
            const user = await User.findOne({email});
            if(user){
                const {receiver,message} = req.body;
                const receiverUser = await User.findById(receiver);
                if(!receiverUser){
                    res.status(404).json({auth_message:"Receiver not found"})
                }else{
                    const createdMessage = new Message({
                        sender:user._id,
                        receiver:receiver,
                        message:message
                    })
                    await createdMessage.save();
                    res.status(201).json({ok:true,message:{
                        id:createdMessage._id,
                        from:user.email,
                        to:receiverUser.email,
                        message:createdMessage.message,
                        createdAt:createdMessage.createdAt,
                        read:createdMessage.isRead
                    }});
                }
            }else{
                res.status(401).json({auth_message:"unauthorized"})
            }
        }else{
            res.status(401).json({auth_message:"unauthorized"})
        }
    } catch (error) {
        console.log(error);
    }
})
messageRouter.delete("/delete/:id",async(req:Request,res:Response)=>{
    try {
        const auth_token = req.cookies.auth_token;
        if(auth_token){
            const {email} = jwt.verify(auth_token,process.env.SECRET_KEY as string) as {email:string};
            const user = await User.findOne({email});
            if(user){
                if(user.role === "ADMIN"){
                    const {id} = req.params;
                    const message = await Message.findByIdAndDelete(id);
                    res.status(201).json({success_message:"message deleted successfully"})
                }else{
                    res.status(403).json({auth_message:"You are not authorized to delete messages"})
                }
            }else{
                res.status(401).json({auth_message:"unauthorized"})
            }
        }else{
            res.status(401).json({auth_message:"unauthorized"})
        }
    } catch (error) {
        console.log(error);
    }
})
messageRouter.put("/update/:id",async(req:Request,res:Response)=>{
    try {
        const auth_token = req.cookies.auth_token;
        if(auth_token){
            const {email} = jwt.verify(auth_token,process.env.SECRET_KEY as string) as {email:string};
            const user = await User.findOne({email});
            if(user){
                if(user.role === "ADMIN"){
                    const {id} = req.params;
                    const {message} = req.body;
                    const updatedMessage = await Message.findByIdAndUpdate(id,{message})
                    res.status(201).json({success_message:"message updated successfully"})
                }else{
                    res.status(403).json({auth_message:"You are not authorized to update messages"})
                }
            }else{
                res.status(401).json({auth_message:"unauthorized"})
            }
        }else{
            res.status(401).json({auth_message:"unauthorized"})
        }
    } catch (error) {
        console.log(error);
    }
})
export default messageRouter;