import mongoose, { Schema, Document } from 'mongoose';

export interface IFeatureConfig {
  key: string;
  enabled: boolean;
  updatedBy?: string;
}

export interface IFeatureConfigDocument extends IFeatureConfig, Document {}

const featureConfigSchema = new Schema<IFeatureConfigDocument>(
  {
    key: { type: String, required: true, unique: true },
    enabled: { type: Boolean, required: true },
    updatedBy: { type: String },
  },
  { timestamps: true }
);

export const FeatureConfig = mongoose.model<IFeatureConfigDocument>('FeatureConfig', featureConfigSchema);
