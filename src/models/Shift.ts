import mongoose from "mongoose";
import { shiftStatus } from "./enum.constants";

const ShiftSchema = new mongoose.Schema({
  createdAt: { 
    type: Date, 
    default: Date.now()
  },

  startTime: { 
    type: Date, 
    default: Date.now()
  },

  endTime: { 
    type: Date, 
    default: undefined
  },

  status : {
    type: String,
    enum: shiftStatus, 
    default: shiftStatus.IN_PROGRESS, 
  },

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
});

export const Shift = mongoose.models.Shift || mongoose.model("Shift", ShiftSchema);