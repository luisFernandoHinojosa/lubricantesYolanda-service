
import db from '../../database/index.js';

export const saveError = async (error) => {
  try {
    await db.Error.create({
      status: error.status || 500,
      message: error.message,
      stack: error.stack,
    });
  } catch (dbError) {
    console.error('Failed to save error to database:', dbError);
  }
};
