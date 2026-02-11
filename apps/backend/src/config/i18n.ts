import i18next from 'i18next';
import middleware from 'i18next-http-middleware';
import Backend from 'i18next-fs-backend';
import path from 'path';

i18next
  .use(Backend)
  .use(middleware.LanguageDetector)
  .init({
    backend: {
      loadPath: path.join(__dirname, '../locales/{{lng}}/{{ns}}.json'),
    },
    fallbackLng: 'zh', // Default to Chinese as requested
    preload: ['zh', 'en'],
    ns: ['translation'],
    defaultNS: 'translation',
    detection: {
      order: ['header', 'querystring', 'cookie'],
      caches: ['cookie'],
      lookupHeader: 'accept-language',
    },
  });

export default i18next;
import { Handler } from 'express';

// ... other imports

export const i18nMiddleware: Handler = middleware.handle(i18next) as any;
