import { Schema, model } from 'mongoose';

const cardSchema = new Schema({
  products: [
    {
      id: {
        type: Schema.Types.ObjectId,
        ref: 'Product',
        required: true
      },
      status: {
        type: String,
        enum: ['PENDING', 'COMPLETED', 'CANCELLED'],
        default: 'PENDING'
      },
      count:{
        type: Number,
        required: true,
        default: 1
      },
      addedOn:{
        type: Date,
        required: true,
        default: new Date()
      }
    }
  ],
  user: {
    type: Schema.Types.ObjectId,
    ref:"user",
    required: true
  },
  totalPrice: {
    type: Number,
    required: true,
    default: 0
  }
}, {
  timestamps: true
});

export default model('Card', cardSchema);
