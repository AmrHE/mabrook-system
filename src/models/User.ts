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

  // Which project/company this employee belongs to. Every legacy document is a
  // "mabrook" employee (hence the default + one-off backfill in
  // src/app/api/projects/backfill). The valid set is (base ∪ ProjectAddition),
  // surfaced through /api/projects and managed by admins on the settings page.
  project: {
    type: String,
    default: "mabrook",
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

  deletedAt: { 
    type: Date, 
    default: Date.now 
  },

  phoneNumber: String,

  // Payroll / banking details.
  salary: Number,

  iban: String,

  bankName: String,

  // National identity.
  identityNumber: String,

  // Cloudinary URL of the uploaded identity document image.
  identityImage: String,

  // Hospitals this employee is assigned to. Many-to-many: a hospital may be
  // assigned to several employees (no reciprocal uniqueness constraint).
  assignedHospitals: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "Hospital",
    default: []
  },

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
  },

  isActive: {
    type: Boolean,
    default: true
  },

});

export const User = mongoose.models.User || mongoose.model("User", UserSchema);