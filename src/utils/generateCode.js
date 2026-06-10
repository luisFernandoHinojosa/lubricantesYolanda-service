import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 8);

export const generateCode = async (prefix) => {
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    const code = `${prefix}-${nanoid()}`;
    
    try {
      return code;
    } catch (error) {
      if (error.code === 11000) {
        attempts++;
        continue;
      }
      throw error;
    }
  }
  
  throw new Error('Error generando código único');
};