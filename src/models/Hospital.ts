import mongoose from "mongoose";

const HospitalSchema = new mongoose.Schema({
  createdAt: { 
    type: Date, 
    default: Date.now 
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  name: {
    type: String,
    unique: true,
  },

  isActive: {
    type: Boolean,
    default: true,
  },

  deletedAt: { 
    type: Date, 
    default: Date.now 
  },

  city: String,

  district: String,

  // Geographic anchor for geofencing shift/visit check-ins. Optional: hospitals
  // created before this feature have no coordinates until an admin sets them
  // (check-ins against them record fenceStatus HOSPITAL_NOT_CONFIGURED).
  location: {
    lat: Number,
    lng: Number,
  },

  productStocks: [{
    product: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Product' 
    },
    quantity: Number,
    lastRestockedAt: Date
  }]
});

export const Hospital = mongoose.models.Hospital || mongoose.model("Hospital", HospitalSchema);