import { Schema, model, type InferSchemaType } from 'mongoose'

const serviceCategorySchema = new Schema(
  {
    mode: { type: String, enum: ['ride', 'transport'], required: true },
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String },
    icon: { type: String, default: 'car' },
    seats: { type: Number },
    capacityLabel: { type: String },
    vehicleType: { type: Schema.Types.ObjectId, ref: 'VehicleType' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
)

export type ServiceCategoryDocument = InferSchemaType<typeof serviceCategorySchema>
export const ServiceCategory = model('ServiceCategory', serviceCategorySchema)
