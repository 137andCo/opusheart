import mongoose from 'mongoose';
import pino from 'pino';

const logger = pino({ name: 'database' });

export async function connectDatabase(uri: string): Promise<typeof mongoose> {
  try {
    const conn = await mongoose.connect(uri);
    logger.info('MongoDB connected: %s', conn.connection.host);
    return conn;
  } catch (err) {
    logger.error(err, 'MongoDB connection failed');
    throw err;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
