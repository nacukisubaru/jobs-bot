import { Model } from 'mongoose';

export type SettingsValue = Record<string, any>;

export interface Settings {
  key: string;
  value: SettingsValue;
}

export interface SettingsDocument extends Settings, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface ISettingsModel extends Model<SettingsDocument> {
  getByKey(key: string): Promise<SettingsDocument>;
  updateByKey(key: string, value: SettingsValue): Promise<SettingsDocument>;
}
