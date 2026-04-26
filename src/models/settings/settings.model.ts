import {
  Schema,
  model,
} from 'mongoose';

import { ISettingsModel, SettingsDocument, SettingsValue } from './settings.types';

const SettingsSchema = new Schema<SettingsDocument>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    value: {
      type: Schema.Types.Mixed,
      required: true,
      default: {},
    },
  },
  {
    timestamps: true,
  },
);

SettingsSchema.statics.getByKey = async function (
  key: string,
) {
  let settings = await this.findOne({ key });

  if (!settings) {
    settings = await this.create({
      key,
      value: {},
    });
  }

  return settings;
};

SettingsSchema.statics.updateByKey = async function (
  key: string,
  value: SettingsValue,
) {
  const updated = await this.findOneAndUpdate(
    { key },
    {
      $set: {
        value,
        updatedAt: new Date(),
      },
    },
    {
      new: true,
      upsert: true,
    },
  );

  return updated;
};

export const SettingsModel = model<
SettingsDocument,
ISettingsModel
>(
  'Settings',
  SettingsSchema,
);
