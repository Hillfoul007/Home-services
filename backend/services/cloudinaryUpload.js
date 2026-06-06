/**
 * Cloudinary upload helper.
 * New uploads go to Cloudinary; old GridFS files still served from MongoDB.
 *
 * Required env vars:
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 */

const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a Buffer to Cloudinary.
 * @param {Buffer} buffer  - file data
 * @param {string} mimeType - e.g. "image/jpeg" or "video/mp4"
 * @param {string} folder   - Cloudinary folder, e.g. "laundrify/pickup-slips"
 * @returns {Promise<string>} secure_url
 */
async function uploadToCloudinary(buffer, mimeType = "image/jpeg", folder = "laundrify") {
  const base64 = buffer.toString("base64");
  const dataUri = `data:${mimeType};base64,${base64}`;

  const isVideo = mimeType.startsWith("video/");

  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type: isVideo ? "video" : "image",
    quality:       isVideo ? "auto" : "auto:good",
    fetch_format:  isVideo ? undefined : "auto",
  });

  return result.secure_url;
}

module.exports = { uploadToCloudinary };
