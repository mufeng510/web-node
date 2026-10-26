export type Locale = 'en' | 'zh-CN';

export interface LocaleMessages {
  [key: string]: string | LocaleMessages;
}

import enMessages from '../locales/en.json';
import zhCNMessages from '../locales/zh-CN.json';

const LOCALES: Record<Locale, LocaleMessages> = {
  en: enMessages as LocaleMessages,
  'zh-CN': zhCNMessages as LocaleMessages,
};

let currentLocale: Locale = 'en';
const listeners = new Set<(locale: Locale) => void>();

/** 注册（或替换）某语言的全部消息表，供构建时或运行时合并翻译。 */
export function registerMessages(locale: Locale, messages: LocaleMessages) {
  LOCALES[locale] = { ...LOCALES[locale], ...messages };
}

/** 切换语言，持久化到 localStorage 并通知所有订阅者重渲染。 */
export function setLocale(locale: Locale) {
  if (currentLocale === locale) return;
  currentLocale = locale;
  try {
    localStorage.setItem('locale', locale);
  } catch {
    // storage unavailable — the locale still applies for this session
  }
  for (const fn of listeners) fn(locale);
}

/** 当前语言。 */
export function getLocale(): Locale {
  return currentLocale;
}

/** 按点号路径取翻译，支持 {{param}} 简单替换；找不到时原样返回 key。 */
export function t(key: string, params?: Record<string, string | number>): string {
  const messages = LOCALES[currentLocale];
  const parts = key.split('.');
  let node: unknown = messages;
  for (const part of parts) {
    if (node && typeof node === 'object' && part in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[part];
    } else {
      return key;
    }
  }
  if (typeof node !== 'string') return key;
  let result = node;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      result = result.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
    }
  }
  return result;
}

/** 初始化语言：localStorage > 浏览器语言 > en。在应用入口调用一次。 */
export function initLocale() {
  try {
    const stored = localStorage.getItem('locale') as Locale | null;
    if (stored === 'en' || stored === 'zh-CN') {
      currentLocale = stored;
      return;
    }
  } catch {
    // storage unavailable
  }
  const navLang =
    typeof navigator !== 'undefined' ? (navigator.language as Locale | undefined) : undefined;
  if (navLang === 'zh-CN' || navLang?.startsWith('zh')) {
    currentLocale = 'zh-CN';
  }
}

/** 订阅语言切换，返回取消订阅函数。 */
export function onLocaleChange(listener: (locale: Locale) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
