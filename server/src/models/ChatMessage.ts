import { Schema, model } from 'mongoose'

// In-trip chat
const chatMessageSchema = new Schema(
  {
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    from: { type: String, enum: ['customer', 'driver'], required: true },
    senderId: { type: Schema.Types.ObjectId, required: true },
    text: { type: String, required: true },
  },
  { timestamps: true },
)
export const ChatMessage = model('ChatMessage', chatMessageSchema)
