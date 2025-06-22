/* eslint-disable @typescript-eslint/no-explicit-any */
import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';

declare module 'next/server' {
  interface NextRequest {
    user?: any;
  }
}

const authGuard = async (req: NextRequest)=> {

  const authHeader = req.headers.get('authorization');
  const userToken = authHeader?.split(" ")[1];

  if (!userToken){
    return NextResponse.json({status: 401, message: "Session has timed out. Please log in to use FableBox"})
  }

  try {
    const userPayload = jwt.verify(userToken, process.env.AUTH_SECRET as string);

    req.user = userPayload

    NextResponse.next()

  } catch (err: any){
    console.error(err);
    let message = err.message;
    if (err.name == "TokenExpiredError"){
      message = "you need to login again first"
    }
    NextResponse.json({status:401, message})
  }
  
}

export default authGuard;