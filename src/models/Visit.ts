import mongoose from 'mongoose';
import { shiftStatus, fenceStatus } from './enum.constants';

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

  moms: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'Mom',
    default: [],
  },

  // Where the employee was when the visit started / ended (device GPS), mirroring
  // the Shift model's startLocation / endLocation.
  startLocation: {
    lat: Number,
    lng: Number,
  },
  endLocation: {
    lat: Number,
    lng: Number,
  },

  // Geofence classification of the visit check-in against its hospital (soft; never blocks).
  startFenceStatus: {
    type: String,
    enum: fenceStatus,
    default: undefined,
  },
  startDistanceMeters: { type: Number, default: undefined },

  status : {
    type: String,
    enum: shiftStatus, 
    default: shiftStatus.IN_PROGRESS, 
  },

    isActive: {
    type: Boolean,
    default: true,
  },

  deletedAt: { 
    type: Date, 
    default: Date.now 
  },
});

export const Visit = mongoose.models.Visit || mongoose.model('Visit', VisitSchema);
