/**
 * Cloudinary upload service.
 *
 * Replaces local `./uploads/` disk storage with Cloudinary cloud storage.
 * Receives a file Buffer (from multer memoryStorage), uploads it to Cloudinary,
 * and returns the secure HTTPS CDN URL to be stored in the database.
 *
 * Required environment variables:
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 */

import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export interface CloudinaryUploadOptions {
  folder: string;
  resource_type: 'image' | 'raw' | 'auto' | 'video';
  public_id?: string;
}

/**
 * Uploads a Buffer to Cloudinary and returns the secure CDN URL.
 *
 * @param buffer - File buffer from multer memoryStorage (req.file.buffer)
 * @param options - Cloudinary folder, resource_type, and optional public_id
 * @returns Promise<string> — the secure Cloudinary HTTPS URL
 */
export function uploadToCloudinary(
  buffer: Buffer,
  options: CloudinaryUploadOptions,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder,
        resource_type: options.resource_type,
        ...(options.public_id ? { public_id: options.public_id } : {}),
      },
      (error, result) => {
        if (error) {
          reject(new Error(`Cloudinary upload failed: ${error.message}`));
          return;
        }
        if (!result?.secure_url) {
          reject(new Error('Cloudinary upload succeeded but returned no URL.'));
          return;
        }
        resolve(result.secure_url);
      },
    );
    stream.end(buffer);
  });
}
