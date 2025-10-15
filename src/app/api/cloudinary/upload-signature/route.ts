import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function POST(req: Request) {
  try {
    const { signature } = await req.json()

    if (!signature) {
      return Response.json({ error: 'No signature provided' }, { status: 400 })
    }

    // Upload base64 directly to Cloudinary
    const uploadResponse = await cloudinary.uploader.upload(signature, {
      folder: 'signatures',
    })

    return Response.json({
      url: uploadResponse.secure_url,
      public_id: uploadResponse.public_id,
    })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Upload error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
