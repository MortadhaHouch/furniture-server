import {Schema,model} from "mongoose"

const cardSchema = new Schema({
    products:{
        type:[Schema.Types.ObjectId],
        ref:"Product"
    },
    user:{
        type:Schema.Types.ObjectId,
        ref:"User"
    },
    totalPrice:{
        type:Number,
        required:true,
        default:0
    }
},{
    timestamps:true
})

export default model("Card",cardSchema)
