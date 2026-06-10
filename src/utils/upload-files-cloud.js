import cloudinary from '../plugins/cloudinary.plugin.js';

export class UploadFile {

  static uploadToCloudinary(folder, buffer) {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'image' },
        (error, result) => {
          if (error) return reject(error);
          resolve(result.secure_url);
        }
      );
      stream.end(buffer);
    });
  }

  static async uploadMultipleToCloudinary(folder, filesData) {
    const promises = filesData.map(({ buffer }) =>
      this.uploadToCloudinary(folder, buffer)
    );
    return Promise.all(promises);
  }
}