export const routes = {
  login: '/login',
  setup: '/setup',
  home: '/',
  editor: (libraryId: string, notePath?: string) =>
    `/editor/${libraryId}${
      notePath ? `/${notePath.split('/').map(encodeURIComponent).join('/')}` : ''
    }`,
  settings: '/settings',
  diagnostics: '/diagnostics',
} as const;
