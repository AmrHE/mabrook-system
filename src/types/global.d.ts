import { userRoles } from '@/models/enum.constants';
import {Mongoose} from 'mongoose'

// Extend Window interface to include Google API types
declare global {
  
  // eslint-disable-next-line no-var
  var mongoose: {
    conn: Mongoose | null;
    promise: Promise<Mongoose> | null;
  }
}

interface TokenPayload {
  userId: string;
  email: string;
  role: userRoles;
  // ... other properties
}