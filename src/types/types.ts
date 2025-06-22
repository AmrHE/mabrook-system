import { shiftStatus } from "../models/enum.constants";

export interface ShiftType {
  _id: string;
  createdAt: string;
  startTime: string;
  endTime?: string | undefined;
  status: shiftStatus;
  userId: string;
}