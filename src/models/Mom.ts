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

  // Optional — not all records will have it.
  age: Number,

  nationality: String,

  address: String,

  phoneNumber: String,

  allowFutureCom: {
    type: Boolean,
    default: true,
  },

  numberOfKids: { type: Number, required: true },

  numberOfnewborns: { type: Number, required: true },

  numberOfMales: { type: Number, required: true },

  numberOfFemales: { type: Number, required: true },

  // Optional — apps this mom installed. A mom may install several (3-4). Values
  // are canonical app names from the admin-managed list (base ∪ AppAddition),
  // surfaced through /api/apps and managed on the settings page.
  installedApp: {
    type: [String],
    default: [],
  },

  signature: {
    type: String,
    default: '',
    required: false,
  },

  // Required: one gender per newborn. An empty array is only valid when there
  // are zero newborns (validator compares against numberOfnewborns).
  genderOfNewborns: {
    type: [String],
    required: true,
    validate: {
      validator: function (this: { numberOfnewborns?: number }, arr: string[]) {
        return (
          Array.isArray(arr) &&
          arr.length === (this.numberOfnewborns || 0) &&
          arr.every((g) => g === "Male" || g === "Female")
        );
      },
      message: "يجب تحديد جنس كل مولود",
    },
  },

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