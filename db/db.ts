import dotenv from 'dotenv';
import mongoose from "mongoose";
dotenv.config()
export default async function connectToDB(){
    try {
        await mongoose.connect(process.env.MONGO_URI as string)
        console.log("connected to database");
    } catch (error) {
        console.log(error);
    }
}