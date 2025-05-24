import mongoose, {Schema,model} from "mongoose"
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
categorySchema.pre("deleteOne", { document: false, query: true }, async function (next) {
    const filter = this.getFilter();
    const categoryId = filter._id;
    if (!categoryId) {
        return next(new Error("Category ID is required for deletion."));
    }

    try {
        const category = await this.model.findOne(filter).exec();
        if (!category) {
            return next(new Error("Category not found."));
        }
        await mongoose.model("Product").deleteMany({ category: category.name });
        next();
    } catch (error) {
        next();
    }
});
export default model("Category", categorySchema)