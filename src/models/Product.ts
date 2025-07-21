import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema({
  createdAt: { 
    type: Date, 
    default: Date.now 
  },

  name: String,
  description: String,
  imageUrl: String,
  totalQuantity: Number,
  warehouseQuantity: Number,
  hospitalsQuantity: Number,
  size: {type: String, default: "N/A"},
  questions: [String],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
});

export const Product = mongoose.models.Product || mongoose.model("Product", ProductSchema);