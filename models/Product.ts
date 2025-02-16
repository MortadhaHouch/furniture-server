import {Schema,model} from "mongoose"

const productSchema = new Schema({
    name: {type: String, required: true},
    price: {type: Number, required: true},
    description: {type: String, required: false},
    category: {type: String, required: true},
    images: {type: [String], default:[]},
    quantity: {type: Number, default:0},
    sold: {type: Number, default: 0},
    reviews: [{
        userId: {type: Schema.Types.ObjectId, ref: "User"},
        comment: {type: String, required: true},
        rating: {type: Number, required: true},
        createdAt: {type: Date, default: Date.now}
    }]
},{
    timestamps: true
})

export default model("Product", productSchema)