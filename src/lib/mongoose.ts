 

// import { Hospital } from '@/models/Hospital'
// import { Shift } from '@/models/Shift'
// import { User } from '@/models/User'
// import { Visit } from '@/models/Visit'
import mongoose from 'mongoose'

// Import all your models here - this ensures they are registered
import '@/models/User'
import '@/models/Visit'
import '@/models/Hospital'
import '@/models/Shift'
import '@/models/Mom'
import '@/models/Product'

const MONGODB_URI = process.env.MONGO_URI

if (!MONGODB_URI) {
  throw new Error(
    'Please define the MONGODB_URI environment variable inside .env.local',
  )
}


let cached = global.mongoose

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null }
}

async function dbConnect() {
    if (cached.conn) {
        return cached.conn
    }
    if (!cached.promise) {
        const opts = {
            bufferCommands: false,
        }
        cached.promise = mongoose.connect(MONGODB_URI as string, opts).then(mongoose => {
            console.log('Db connected')
            // Models are imported at the top to ensure they are registered
            return mongoose
        })
    }
    try {
        cached.conn = await cached.promise
    } catch (e) {
        cached.promise = null
        throw e
    }

    return cached.conn
}
export async function initDb() {
  try {
    await dbConnect()
  } catch (error) {
    console.error('Failed to initialize MongoDB:', error)
    throw error
  }
}

export async function disconnectFromDatabase() {
  if (cached.conn) {
    await cached.conn.disconnect()
    cached.conn = null
    cached.promise = null
  }
}

export default dbConnect

