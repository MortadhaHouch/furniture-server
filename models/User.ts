import {Schema,model} from "mongoose"
import bcrypt from "bcrypt"
const userSchema = new Schema({
    firstName:{
        type:String,
        required:true
    },
    lastName:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    avatar:{
        type:String,
        default:"",
        required:false
    },
    password:{
        type:String,
        required:true
    },
    role:{
        type:String,
        enum:["USER","ADMIN"],
        default:"USER"
    },
    address:{
        type:String,
        required:true
    },
    phone:{
        type:String,
        required:true
    },
    card:{
        type:[Schema.Types.ObjectId],
        default:[],
        ref:"Card"
    },
    savedProducts:{
        type:[Schema.Types.ObjectId],
        default:[]
    }
},{
    timestamps:true
})
userSchema.pre("save",async function(){
    if(this.isNew || this.isModified("password")){
        const hashedPassword = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password,hashedPassword);
    }
})
const userModel = model("user",userSchema)
export default userModel