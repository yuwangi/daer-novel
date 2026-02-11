import { TFunction } from 'i18next';

declare global {
  namespace Express {
    interface Request {
      t: TFunction;
      language: string;
      languages: string[];
    }
  }
}
