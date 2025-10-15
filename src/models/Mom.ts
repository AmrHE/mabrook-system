import mongoose from "mongoose";

const MomSchema = new mongoose.Schema({
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
    ref: "User",
  },

  name: String,

  nationality: String,

  address: String,

  phoneNumber: String,

  allowFutureCom: {
    type: Boolean,
    default: true,
  },

  numberOfKids: Number,

  numberOfnewborns: Number,

  numberOfMales: Number,

  numberOfFemales: Number,
  
  signature: {
    type: String,
    default: '',
    required: false,
  },

  genderOfNewborns: [String],

  isActive: {
    type: Boolean,
    default: true,
  },

  deletedAt: { 
    type: Date, 
    default: Date.now 
  },

  survey: [{
    product: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Product' 
    },
    QA: [{
      question: String,
      answer: String,
    }]
  }]
});

export const Mom = mongoose.models.Mom || mongoose.model("Mom", MomSchema);