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
    secondaryEmail:{
        type:String,
        required:false,
        default:""
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
        enum:["USER","ADMIN","SUPER_ADMIN"],
        default:"USER"
    },
    address:{
        type:String,
        required:false
    },
    phone:{
        type:Number,
        required:false
    },
    card:{
        type:[Schema.Types.ObjectId],
        default:[],
        ref:"Card"
    },
    savedProducts:{
        type:[Schema.Types.ObjectId],
        default:[]
    },
    isLoggedIn:{
        type:Boolean,
        default:false
    },
    notifications:{
        type:[Schema.Types.ObjectId],
    },
    notificationsEnabled:{
        type:Boolean,
        default:true
    }
},{
    timestamps:true
})
userSchema.pre("save",async function(){
    if(this.isNew || this.isModified("password")){
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(this.password,salt);
        this.password = hashedPassword;
    }
})
const userModel = model("user",userSchema)
export default userModel