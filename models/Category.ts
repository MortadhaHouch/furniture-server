import {Schema,model} from "mongoose"
const categorySchema = new Schema({
    name:{
        type:String,
        required:true,
        unique:true
    },
    description:{
        type:String,
        required:true
    },
    image:{
        type:String,
        required:false
    },
    products:{
        type:[Schema.Types.ObjectId],
    }
},{
    timestamps:true
})

export default model("Category", categorySchema)