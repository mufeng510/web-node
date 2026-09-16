import type * as Preset from '@docusaurus/preset-classic';
import type { Config } from '@docusaurus/types';
import { themes as prismThemes } from 'prism-react-renderer';

const config: Config = {
  title: 'Web Note',
  tagline:
    'Browser-first, Self-hosted, Markdown-first, Obsidian-compatible, AI-native personal knowledge base',
  favicon: 'img/favicon.ico',
  url: 'https://web-note.github.io',
  baseUrl: '/',
  organizationName: 'web-note',
  projectName: 'web-note',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh-CN'],
    localeConfigs: {
      en: { htmlLang: 'en-US' },
      'zh-CN': { htmlLang: 'zh-CN' },
    },
  },
  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/web-note/web-note/tree/main/website/',
          showLastUpdateAuthor: true,
          showLastUpdateTime: true,
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: 'all',
            copyright: `Copyright © ${new Date().getFullYear()} Web Note.`,
          },
          editUrl: 'https://github.com/web-note/web-note/tree/main/website/',
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],
  themeConfig: {
    image: 'img/social-card.jpg',
    navbar: {
      title: 'Web Note',
      logo: { alt: 'Web Note Logo', src: 'img/logo.svg' },
      items: [
        { type: 'docSidebar', sidebarId: 'tutorialSidebar', position: 'left', label: 'Docs' },
        { to: '/blog', label: 'Blog', position: 'left' },
        { type: 'localeDropdown', position: 'right' },
        { href: 'https://github.com/web-note/web-note', label: 'GitHub', position: 'right' },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            { label: 'Getting Started', to: '/docs/getting-started' },
            { label: 'Architecture', to: '/docs/architecture' },
            { label: 'API Reference', to: '/docs/api' },
          ],
        },
        {
          title: 'Community',
          items: [
            { label: 'Discord', href: 'https://discord.gg/web-note' },
            {
              label: 'GitHub Discussions',
              href: 'https://github.com/web-note/web-note/discussions',
            },
            { label: 'Twitter', href: 'https://twitter.com/web_note' },
          ],
        },
        {
          title: 'More',
          items: [
            { label: 'Blog', to: '/blog' },
            { label: 'GitHub', href: 'https://github.com/web-note/web-note' },
            {
              label: 'Docker',
              href: 'https://github.com/web-note/web-note/pkgs/container/web-note',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Web Note. Built with Docusaurus.`,
    },
    prism: { theme: prismThemes.github, darkTheme: prismThemes.dracula },
    algolia: { appId: '', apiKey: '', indexName: '' },
  } satisfies Preset.ThemeConfig,
};

export default config;
