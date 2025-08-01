import mongoose from "mongoose";
import { userRoles } from "./enum.constants";

const UserSchema = new mongoose.Schema({
  firstName: String,

  lastName: String,

  email: { 
    type: String, 
    unique: true 
  },

  passwordHash: String,

  role: { 
    type: String, 
    enum: userRoles, 
    default: userRoles.EMPLOYEE, 
  },

  createdAt: { 
    type: Date, 
    default: Date.now 
  },

  updatedAt: { 
    type: Date, 
    default: Date.now 
  },

  lastLogin: { 
    type: Date, 
    default: Date.now 
  },

  phoneNumber: String,
  shifts: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "Shift",
    default: []
  },

  visits: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "Visit",
    default: []
  },

  isOnShift: {
    type: Boolean,
    default: false
  }
});

export const User = mongoose.models.User || mongoose.model("User", UserSchema);