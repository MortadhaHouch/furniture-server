import express, { NextFunction, Request, Response } from "express"
import cors from "cors";
import bodyParser from "body-parser"
import cookieParser from "cookie-parser"
const app = express()
import dotenv from "dotenv";
import fileUpload from "express-fileupload"
import connectToDB from "./db/db"
import userController from "./controllers/userController"
import productController from "./controllers/productController"
import helmet from "helmet"
import messageRouter from "./controllers/messageController";
import notificationController from "./controllers/notificationController";
import categoryController from "./controllers/categoryController";
import path from "path"
import fs from "fs"
import FormData from "form-data";
dotenv.config()
app.use(cors({
    methods:["GET","POST","PUT","DELETE"],
    origin:"http://localhost:3000",
    credentials: true,
}))
app.use(helmet())
app.use(express.json({limit:"50mb"}))
app.use(bodyParser.json({limit:"50mb"}))
app.use(cookieParser(process.env.SECRET_KEY as string));
app.use(fileUpload({
    preserveExtension:true,
    createParentPath:true
}))
app.use((req:Request,res:Response,next:NextFunction)=>{
    console.log(req.url,req.method);
    next()
})
app.use("/user",userController);
app.use("/product",productController);
app.use("/notification",notificationController);
app.use("/category",categoryController);
app.use("/message",messageRouter);
connectToDB()
const {PORT} =process.env;
app.get("/:filename",(req,res)=>{
    const {filename} = req.params;
    if(fs.existsSync(path.join(__dirname,"uploads",filename))){
        const contentType = path.extname(filename).slice(1);
        const formData = new FormData();
        formData.append("file",fs.createReadStream(path.join(__dirname,"uploads",filename)),{
            contentType,
            filename
        });
        res.setHeader("Content-Type",`multipart/form-data; boundary=${formData.getBoundary()}`);
        formData.pipe(res);
    }else{
        res.status(404).json({message:"File not found"})
    }
})
app.listen(PORT,()=>console.log("server listening on port ",PORT))