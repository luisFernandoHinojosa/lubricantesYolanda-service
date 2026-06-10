import { UploadFile } from '../utils/upload-files-cloud.js';
import config from '../config/index.js';

export const generatePhotoURL = async (file, defaultPhotoUrl) => {
    if (!file) {
        return defaultPhotoUrl;
    }
    const folder = config.server.nodeEnv === 'development'
        ? 'desarrollo/lubricantesY'
        : 'produccion/lubricantesY';
    return await UploadFile.uploadToCloudinary(folder, file.buffer);
};

export const generatePhotoURLupdate = async (entity, file) => {
    return await UploadFile.uploadToCloudinary(entity, file.buffer);
};
