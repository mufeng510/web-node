import { useEffect, useState } from 'react';
import { getLocale, onLocaleChange, t } from '../lib/i18n';

/** React 风格的翻译 hook，语言切换会自动触发重渲染。 */
export function useTranslation() {
  const [locale, setLocale] = useState(getLocale());

  useEffect(() => {
    const unsub = onLocaleChange((next) => {
      setLocale(next);
    });
    return unsub;
  }, []);

  return { t, locale };
}
