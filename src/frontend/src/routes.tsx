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
  search: '/search',
  notifications: '/notifications',
  tasks: '/tasks',
  users: '/users',
  audit: '/audit',
  ai: '/ai',
  mcp: '/mcp',
} as const;
