import mongoose from "mongoose";

const HospitalSchema = new mongoose.Schema({
  createdAt: { 
    type: Date, 
    default: Date.now 
  },

  visitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Visit",
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  location: {
    lat: Number,
    lng: Number,
  },

  name: {
    type: String,
    unique: true,
  },

  city: String,

  district: String,

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