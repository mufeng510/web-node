export const routes = {
  login: '/login',
  setup: '/setup',
  home: '/',
  editor: (libraryId: string, notePath?: string) =>
    `/editor/${libraryId}${notePath ? `/${encodeURIComponent(notePath)}` : ''}`,
  settings: '/settings',
  diagnostics: '/diagnostics',
} as const;
