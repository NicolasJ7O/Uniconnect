import { ForumHandler, ForumRequestContext } from './forum-handler.js';
import { AppError } from '../../../errors/app-error.js';

const BANNED_WORDS = [
  'mierda', 'puto', 'puta', 'gonorrea', 'malparido', 
  'hijueputa', 'hpta', 'hp', 'marica', 'carechimba'
];

export class ModerationHandler extends ForumHandler {
  protected async process(context: ForumRequestContext): Promise<void> {
    const { action, data } = context;

    if (action === 'CREATE_QUESTION' || action === 'UPDATE_QUESTION') {
      this.checkText(data.title || '');
      this.checkText(data.content || '');
    } else if (action === 'CREATE_ANSWER') {
      this.checkText(data.content || '');
    }
  }

  private checkText(text: string): void {
    const normalized = text.toLowerCase();
    for (const word of BANNED_WORDS) {
      // Create a regex to match the word as a substring or full word
      const regex = new RegExp(`\\b${word}\\b|${word}`, 'i');
      if (regex.test(normalized)) {
        throw new AppError(400, `El contenido contiene lenguaje inapropiado y fue bloqueado por moderación ("${word}")`);
      }
    }
  }
}
