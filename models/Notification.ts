import { model, Schema } from "mongoose";

const notificationSchema = new Schema({
    from: { type: Schema.Types.ObjectId, ref: "User" },
    to:{ type: Schema.Types.ObjectId, ref: "User" },
    message: { type: String, required: true },
    seen: { type: Boolean, default: false },
},{
    timestamps: true,
})
export default model("Notification",notificationSchema);