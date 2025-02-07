import express from "express"
import cors from "cors"
import bodyParser from "body-parser"
import cookieParser from "cookie-parser"
const app = express()
import dotenv from "dotenv";
dotenv.config()
app.use(cors({
    methods:["GET","POST","PUT","DELETE"],
    origin:"http://localhost:3000"
}))
app.use(express.json({limit:Infinity}))
app.use(bodyParser.json({limit:Infinity}))
app.use(cookieParser())
const {PORT} =process.env
app.listen(PORT,()=>console.log("server listening on port ",PORT))