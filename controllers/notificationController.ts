import {Router,Request,Response} from "express";
import User from "../models/User"
import jwt from "jsonwebtoken";
import Notification from "../models/Notification";
const notificationController:Router = Router();
notificationController.get("/:p?",async(req:Request, res:Response) => {
    try {
        const auth_token = req.cookies.auth_token;
        if (auth_token) {
            const {email} = jwt.verify(auth_token,process.env.SECRET_KEY as string) as {email:string};
            const user = await User.findOne({email});
            if(user){
                const {p} = req.params;
                const notificationsTasks = [];
                if(p && !isNaN(Number(p))){
                    for(const notification of user.notifications.slice(0,Number(p)*10)){
                        const notificationTask = Notification.findById(notification._id);
                        notificationsTasks.push(notificationTask);
                    }
                }else{
                    const notificationTask = Notification.find({user:user._id}).sort({createdAt: -1}).limit(10);
                    notificationsTasks.push(notificationTask);
                }
                const [foundNotifications] = await Promise.all(notificationsTasks);
                res.json({notifications:foundNotifications,page:Number(p)+1,pages:user.notifications.length,isVerified:true});
            }else{
                res.status(401).json({auth_message:"Unauthorized"});
            }
        }else{
            res.status(401).json({auth_message:"Unauthorized"});
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error" });
    }
})





export default notificationController;