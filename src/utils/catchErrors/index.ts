/* eslint-disable @typescript-eslint/no-explicit-any */
// import { NextFunction, NextRequest, NextResponse} from "express"

import { NextRequest, NextResponse } from "next/server";
import jwt, { SignOptions } from "jsonwebtoken";
import mongoose from "mongoose";
// import { userRoles } from "@/models/enum.constants";
export * from "./customErrors";

// interface ITokenPayload {
//   userId: string;
//   email: string;
//   role: userRoles;
//   // ... other properties
// }

const handleError =(err:any)=> {
  let statusCode, message, errorFields;
  switch (err.code){
    case undefined:
      if (err.name === "ValidationError"){//mongoose
        statusCode = 400;
        errorFields = Object.values(err.errors).map((error: any)=> ({field: error.path, kind: error.kind, message: error.message}));

        message = Object.keys(err.errors).reduce((msg, key)=> {
          msg += err.errors[key].message + ", ";
          return msg;
        }, "").trim();
      } else {// programmtic error
        statusCode = 500; 
        message = "internal server Error: " + err.message;
      }
      break;
    case 11000: // request tried to dublicate a saved unique key (mongoDb error)
      const repeatedField = Object.keys(err.keyValue)[0];
      errorFields = [{field: repeatedField, kind: "dublicate", message: `this ${repeatedField} is already used!`}]
      statusCode = 422;
      message = `this ${repeatedField} is already used before!`;
      break;
    case 401:
      statusCode = 401;
      message = err.message;
      break;
    case 404:
      statusCode = 404;
      message = err.message;
      break;
    default:
      statusCode = 400;
      message = err.message
  }
  console.log(err);
  NextResponse.json({message, errorFields, status: statusCode})
}

export const catchErrors =(
  controller: any
)=> (req:NextRequest, res:NextResponse)=> {

  let session: mongoose.ClientSession;
  async function f () {
    session = await mongoose.startSession();

    session.startTransaction();
    return controller(req, res, NextResponse.next(), session)
  }
  

  return Promise
  .resolve(f())
  .catch(err=> {
    session.abortTransaction();
    handleError(err)
  })
  .finally(()=> session.endSession())
}


const createToken =(tokenData: object, duration = "7d", extraSecret = "")=> {

  const authSecret = process.env.AUTH_SECRET;
  
  if (!authSecret) {
    throw new Error('AUTH_SECRET environment variable is not defined');
  }
  return jwt.sign(
    tokenData,
    authSecret + extraSecret,
    { expiresIn: duration } as SignOptions
  )
}

export default createToken;


export const createUserToken = (user: any, maxDaysAge = '7d')=> {
  const userToken = createToken({
    _id: user._id,
    email: user.email,
    role: user.role
  }, maxDaysAge);
  // TODO refresh token
  
  return {
    userToken,
    tokenExpiration: new Date(Date.now() + parseFloat(maxDaysAge) * 24 * 60 * 60 * 1000)
  }
}
