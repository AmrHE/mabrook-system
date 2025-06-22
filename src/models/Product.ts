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
});

export const Product = mongoose.models.Product || mongoose.model("Product", ProductSchema);