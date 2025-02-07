import {Schema,model} from "mongoose"

const productSchema = new Schema({
    name: {type: String, required: true},
    price: {type: Number, required: true},
    description: {type: String, required: true},
    category: {type: String, required: true},
    images: {type: [String], required: true},
    quantity: {type: Number, required: true},
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