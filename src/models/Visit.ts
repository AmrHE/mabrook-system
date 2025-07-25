import mongoose from 'mongoose';
import { shiftStatus } from './enum.constants';

const VisitSchema = new mongoose.Schema({
  createdAt: {
    type: Date,
    default: Date.now,
  },

  startTime: {
    type: Date,
    default: Date.now,
  },

  endTime: {
    type: Date,
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },

  shiftId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shift',
  },

  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
  },

  momId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mom',
  },

  location: {
    latitude: Number,
    longitude: Number,
  },
  status : {
    type: String,
    enum: shiftStatus, 
    default: shiftStatus.IN_PROGRESS, 
  },
});

export const Visit = mongoose.models.Visit || mongoose.model('Visit', VisitSchema);
