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
app.use(
    fileUpload({
        useTempFiles: true, // Use temporary files for uploads
        tempFileDir: "/tmp/", // Temporary directory for file uploads
        preserveExtension: true, // Preserve file extensions
        createParentPath: true, // Automatically create parent directories
        limits: { fileSize: 50 * 1024 * 1024 }, // Limit file size to 50MB
        abortOnLimit: true, // Abort if file size exceeds the limit
        safeFileNames: true, // Sanitize file names
        debug: process.env.NODE_ENV === "development", // Enable debugging in development
    })
);
app.use((req:Request,res:Response,next:NextFunction)=>{
    console.log(req.url,req.method,new Date().toLocaleDateString());
    next()
})
app.use("/user",userController);
app.use("/product",productController);
app.use("/notification",notificationController);
app.use("/category",categoryController);
app.use("/message",messageRouter);
connectToDB()
const {PORT} =process.env;
app.listen(PORT,()=>console.log("server listening on port ",PORT))