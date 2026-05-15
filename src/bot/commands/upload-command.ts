import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';

import { bot } from '../bot';

import { downloadFile } from '../../common/utils/files';

export async function uploadCommand(msg: TelegramBot.Message) {
  const chatId = msg.chat.id;

  if (!msg.document) {
    await bot.sendMessage(chatId, '📎 Прикрепи JSON-файл к этому сообщению командой /upload');

    return;
  }

  const doc = msg.document;

  if (!doc.file_name?.endsWith('.json')) {
    await bot.sendMessage(chatId, '❌ Нужен файл в формате .json');

    return;
  }

  try {
    const fileInfo = await bot.getFile(doc.file_id);

    const fileUrl = `https://api.telegram.org/file/bot${process.env.TG_TOKEN}/${fileInfo.file_path}`;

    const tmpPath = path.join('tmp', `upload_${Date.now()}.json`);
    fs.mkdirSync('tmp', { recursive: true });

    await downloadFile(fileUrl, tmpPath);

    const raw = fs.readFileSync(tmpPath, 'utf-8');
    const state = JSON.parse(raw);

    fs.writeFileSync('./hh-state.json', JSON.stringify(state, null, 2));
    fs.unlinkSync(tmpPath);

    await bot.sendMessage(chatId, '✅ hh-state.json успешно обновлён!');
  } catch (err) {
    console.error(err);
    await bot.sendMessage(chatId, '❌ Ошибка при загрузке файла. Убедись, что файл является валидным JSON.');
  }
}
