import 'dotenv/config';
import mongoose from 'mongoose';

export async function connectTestDB() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error('MONGODB_URI is not defined in .env file');
  }

  await mongoose.connect(mongoUri);
}

export async function disconnectTestDB() {
  await mongoose.disconnect();
}
