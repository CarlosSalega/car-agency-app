import { v2 as cloudinary } from "cloudinary";

import { CLOUDINARY_UPLOAD_OPTIONS } from "../cloudinary-config";
import { ImageProvider } from "../image-provider.interface";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

export class CloudinaryProvider implements ImageProvider {
  async upload(file: File): Promise<{ key: string; url: string }> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const uploadResult = await new Promise<any>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          CLOUDINARY_UPLOAD_OPTIONS,
          (uploadError, uploadResponse) => {
            if (uploadError) reject(uploadError);
            else resolve(uploadResponse);
          },
        );

        uploadStream.end(buffer);
      });

      return {
        key: uploadResult.public_id,
        url: uploadResult.secure_url,
      };
    } catch (error) {
      console.error("Cloudinary upload error:", error);
      throw new Error("Error al subir imagen a Cloudinary");
    }
  }

  async delete(key: string): Promise<{ success: boolean; error?: string }> {
    try {
      const deleteResult = await cloudinary.uploader.destroy(key);

      if (deleteResult.result === "ok" || deleteResult.result === "not found") {
        return { success: true };
      }

      return { success: false, error: deleteResult.result };
    } catch (error) {
      console.error("Cloudinary delete error:", error);
      return { success: false, error: "Delete failed" };
    }
  }

  async deleteMany(keys: string[]) {
    const deleteResults = await Promise.allSettled(
      keys.map((key) => this.delete(key)),
    );

    const successfulDeletions = deleteResults.filter(
      (deleteResult) =>
        deleteResult.status === "fulfilled" && deleteResult.value.success,
    ).length;

    return {
      successful: successfulDeletions,
      failed: keys.length - successfulDeletions,
    };
  }
}
