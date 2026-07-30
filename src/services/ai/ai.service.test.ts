import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AIService } from './ai.service';
import { connectTestDB, disconnectTestDB } from './test-utils';

const aiService = new AIService();

beforeAll(async () => {
  await connectTestDB();
});

afterAll(async () => {
  await disconnectTestDB();
});

describe('AIService', () => {
  it('generateLetter — возвращает сопроводительное письмо', async () => {
    const letter = await aiService.generateLetter({
      title: 'Senior Frontend Developer',
      company: 'Яндекс',
      link: 'https://example.com/vacancy/123',
      resumes: [],
      letter: '',
      description: `
        Мы ищем опытного Frontend разработчика в команду Яндекс.Маркет.
        Требования: React, TypeScript, опыт от 3 лет.
        Будете работать над высоконагруженным интерфейсом маркетплейса.
        Укажите желаемую зарплату в отклике.
      `,
    });

    console.log('generateLetter result:', letter);
    expect(letter).toBeTruthy();
    expect(typeof letter).toBe('string');
    expect(letter.length).toBeGreaterThan(0);
  });

  it('generateVacancyFormAnswers — возвращает ответы на форму', async () => {
    const formAnswers = await aiService.generateVacancyFormAnswers([
      {
        id: 'experience_years',
        question: 'Сколько лет опыта в разработке?',
      },
      {
        id: 'english_level',
        question: 'Уровень английского?',
        options: { id: '1001', optionText: 'B2' },
      },
      {
        id: 'remote',
        question: 'Формат работы?',
        options: { id: '2002', optionText: 'Удалённо' },
      },
    ]);

    console.log('generateVacancyFormAnswers result:', formAnswers);
    expect(formAnswers).toBeTruthy();
    expect(formAnswers).toHaveProperty('inputs');
    expect(formAnswers).toHaveProperty('options');
  });

  it('generateChatReply — отвечает на сообщение рекрутера', async () => {
    const reply = await aiService.generateChatReply(
      'Добрый день! Меня зовут Анна, я рекрутер в Сбере. '
      + 'Рассматриваете ли вы предложения? Есть интересная вакансия React-разработчика. '
      + 'Напишите мне в телеграм @anna_sber, обсудим детали.',
    );

    console.log('generateChatReply result:', reply);
    expect(reply).toBeTruthy();
    expect(reply).toHaveProperty('type');
    expect(reply).toHaveProperty('messageToHR');
  });

  it('generateResumeSelection — выбирает подходящие резюме', async () => {
    const resumes = await aiService.generateResumeSelection(
      'Senior React Developer',
      [
        'Frontend разработчик — React, TypeScript, 4 года опыта',
        'Fullstack разработчик — Node.js, Vue, PostgreSQL',
        'Backend разработчик — Python, Django, Docker',
        'Frontend разработчик — Angular, RxJS, NgRx',
      ],
    );

    console.log('generateResumeSelection result:', resumes);
    expect(resumes).toBeTruthy();
    expect(Array.isArray(resumes)).toBe(true);
  });
});
