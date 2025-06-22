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

  location: {
    latitude: Number,
    longitude: Number
  },

  name: String,

  nationality: String,

  address: String,

  numberOfKids: Number,

  numberOfnewborns: Number,

  numberOfMales: Number,

  numberOfFemales: Number,

  genderOfNewborns: [String],

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