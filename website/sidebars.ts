import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    'getting-started',
    {
      type: 'category',
      label: 'Guides',
      items: [
        'guides/installation',
        'guides/configuration',
        'guides/libraries',
        'guides/editor',
        'guides/search',
        'guides/git',
        'guides/ai-chat',
        'guides/ai-agent',
        'guides/mcp',
        'guides/sharing',
        'guides/mobile',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      items: [
        'reference/architecture',
        'reference/api',
        'reference/configuration',
        'reference/environment-variables',
        'reference/permissions',
        'reference/markdown-support',
      ],
    },
    {
      type: 'category',
      label: 'Deployment',
      items: [
        'deployment/docker',
        'deployment/fnos',
        'deployment/kubernetes',
        'deployment/upgrade',
        'deployment/backup-restore',
      ],
    },
    {
      type: 'category',
      label: 'Security',
      items: [
        'security/authentication',
        'security/authorization',
        'security/encryption',
        'security/audit',
        'security/best-practices',
      ],
    },
    {
      type: 'category',
      label: 'Development',
      items: [
        'development/setup',
        'development/testing',
        'development/contributing',
        'development/release-process',
      ],
    },
    'faq',
    'changelog',
  ],
};

export default sidebars;
