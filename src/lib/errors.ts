import { ApiError } from './api';
import type { TranslationKey } from './i18n';

export function describeError(
  error: unknown,
  t: (key: TranslationKey) => string,
): string {
  if (error instanceof ApiError) {
    return error.status === 0 ? t('auth.networkError') : error.message;
  }
  return t('error.title');
}
