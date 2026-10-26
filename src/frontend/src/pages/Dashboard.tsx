import { ChevronLeft, ChevronRight, FolderGit2, Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/Dialog';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { PageContextBar } from '../components/ui/PageContextBar';
import { Spinner } from '../components/ui/Spinner';
import { type DiscoverDirectory, type DiscoverResult, useLibraries } from '../hooks/useLibraries';
import { useTranslation } from '../hooks/useTranslation';

export function Dashboard() {
  const { t } = useTranslation();
  const { currentLibrary, createLibrary, discoverLibraryDirs } = useLibraries();
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newLibraryName, setNewLibraryName] = useState('');
  const [newLibraryPath, setNewLibraryPath] = useState('');
  const [creating, setCreating] = useState(false);

  // Select existing mode state
  const [mode, setMode] = useState<'create' | 'select'>('create');
  const [discoverPath, setDiscoverPath] = useState('');
  const [discoverData, setDiscoverData] = useState<DiscoverResult | null>(null);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [selectedFolderName, setSelectedFolderName] = useState('');

  const handleCreateLibrary = async () => {
    if (!newLibraryName.trim() || !newLibraryPath.trim()) return;
    setCreating(true);
    try {
      await createLibrary({ name: newLibraryName, path: newLibraryPath });
      setShowCreateModal(false);
      setNewLibraryName('');
      setNewLibraryPath('');
    } catch (error) {
      console.error('Failed to create library:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleNewNote = () => {
    if (currentLibrary) {
      navigate(`/editor/${currentLibrary.id}`, { state: { newNote: true } });
    }
  };

  const loadDiscover = async (path: string) => {
    setDiscoverLoading(true);
    try {
      const data = await discoverLibraryDirs(path || undefined);
      setDiscoverData(data);
      setDiscoverPath(data.currentPath);
      setSelectedFolderName(data.currentPath.split('/').pop() || '');
    } catch (error) {
      console.error('Failed to load directories:', error);
    } finally {
      setDiscoverLoading(false);
    }
  };

  const handleModeChange = (newMode: 'create' | 'select') => {
    setMode(newMode);
    if (newMode === 'select') {
      loadDiscover('');
    } else {
      setDiscoverData(null);
      setDiscoverPath('');
      setSelectedFolderName('');
    }
  };

  const handleDirectoryClick = (dir: DiscoverDirectory) => {
    loadDiscover(dir.path);
  };

  const handleParentClick = () => {
    if (discoverData && discoverData.parentPath !== null) {
      loadDiscover(discoverData.parentPath);
    }
  };

  const handleBreadcrumbClick = (path: string) => {
    loadDiscover(path);
  };

  const handleAddExistingLibrary = async () => {
    if (!discoverPath.trim() || !selectedFolderName.trim()) return;
    if (discoverData?.currentRegistered) return;
    setCreating(true);
    try {
      await createLibrary({ name: selectedFolderName, path: discoverPath });
      setShowCreateModal(false);
      setMode('create');
      setDiscoverData(null);
      setDiscoverPath('');
      setSelectedFolderName('');
    } catch (error) {
      console.error('Failed to add library:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleDialogClose = () => {
    setShowCreateModal(false);
    setMode('create');
    setNewLibraryName('');
    setNewLibraryPath('');
    setDiscoverData(null);
    setDiscoverPath('');
    setSelectedFolderName('');
    setCreating(false);
  };

  const buildBreadcrumbSegments = (path: string) => {
    if (!path) return [{ name: t('pages.dashboard.breadcrumbRoot'), path: '' }];
    const parts = path.split('/');
    const segments = [{ name: t('pages.dashboard.breadcrumbRoot'), path: '' }];
    let current = '';
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      segments.push({ name: part, path: current });
    }
    return segments;
  };

  const isCurrentFolderRegistered = () => discoverData?.currentRegistered === true;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {!currentLibrary ? (
        <EmptyState
          icon={FolderGit2}
          title={t('pages.dashboard.noLibrarySelected')}
          description={t('pages.dashboard.createOrSelectLibrary')}
          actions={
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4" aria-hidden="true" /> {t('pages.dashboard.createLibrary')}
            </Button>
          }
        />
      ) : (
        <>
          <PageContextBar
            title={currentLibrary.name}
            detail={currentLibrary.path}
            actions={[
              {
                label: t('pages.dashboard.newNote'),
                onClick: handleNewNote,
                primary: true,
                icon: <Plus className="w-4 h-4" aria-hidden="true" />,
              },
              {
                label: t('pages.dashboard.newLibrary'),
                onClick: () => setShowCreateModal(true),
                icon: <FolderGit2 className="w-4 h-4" aria-hidden="true" />,
              },
            ]}
          />

          <EmptyState
            icon={FolderGit2}
            title={t('pages.dashboard.welcomeTo', { name: currentLibrary.name })}
            description={t('pages.dashboard.createFirstNote')}
            actions={
              <Button variant="secondary" onClick={handleNewNote}>
                <Plus className="w-4 h-4" aria-hidden="true" />
                {t('pages.dashboard.newNote')}
              </Button>
            }
          />
        </>
      )}

      <Dialog open={showCreateModal} onOpenChange={handleDialogClose}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>{t('pages.dashboard.dialogAddLibrary')}</DialogTitle>
            <DialogDescription>
              {mode === 'create'
                ? t('pages.dashboard.dialogCreateNew')
                : t('pages.dashboard.dialogSelectExisting')}
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-4">
            {/* Mode Switcher */}
            <div className="flex gap-2 border-b border-border pb-4">
              <button
                type="button"
                onClick={() => handleModeChange('create')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
                  mode === 'create'
                    ? 'bg-primary text-primary-fg'
                    : 'text-fg-muted hover:bg-bg-hover hover:text-fg'
                }`}
              >
                {t('pages.dashboard.modeCreateNew')}
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('select')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
                  mode === 'select'
                    ? 'bg-primary text-primary-fg'
                    : 'text-fg-muted hover:bg-bg-hover hover:text-fg'
                }`}
              >
                {t('pages.dashboard.modeSelectExisting')}
              </button>
            </div>

            {/* Create New Mode */}
            {mode === 'create' && (
              <div className="space-y-4">
                <Input
                  id="libraryName"
                  label={t('pages.dashboard.labelLibraryName')}
                  value={newLibraryName}
                  onChange={(e) => setNewLibraryName(e.target.value)}
                  placeholder={t('pages.dashboard.placeholderLibraryName')}
                />
                <Input
                  id="libraryPath"
                  label={t('pages.dashboard.labelFolderPath')}
                  value={newLibraryPath}
                  onChange={(e) => setNewLibraryPath(e.target.value)}
                  placeholder={t('pages.dashboard.placeholderFolderPath')}
                />
              </div>
            )}

            {/* Select Existing Mode */}
            {mode === 'select' && (
              <div className="space-y-4">
                {/* Breadcrumb */}
                <div className="flex items-center gap-1.5 flex-wrap text-sm">
                  {buildBreadcrumbSegments(discoverPath).map((segment, index) => (
                    <span key={segment.path} className="flex items-center gap-1.5">
                      {index > 0 && (
                        <ChevronRight
                          className="w-4 h-4 text-fg-subtle flex-shrink-0"
                          aria-hidden="true"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => handleBreadcrumbClick(segment.path)}
                        className={`px-2 py-1 rounded transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
                          segment.path === discoverPath
                            ? 'text-fg font-medium'
                            : 'text-fg-muted hover:bg-bg-hover hover:text-fg'
                        }`}
                        aria-label={
                          segment.path
                            ? t('pages.dashboard.ariaGoToPath', { path: segment.path })
                            : t('pages.dashboard.ariaGoToRoot')
                        }
                        aria-current={segment.path === discoverPath ? 'location' : undefined}
                      >
                        {segment.name}
                      </button>
                    </span>
                  ))}
                </div>

                {/* Parent Navigation */}
                {discoverData && discoverData.parentPath !== null && (
                  <button
                    type="button"
                    onClick={handleParentClick}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-fg-muted hover:bg-bg-hover hover:text-fg rounded-md transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                    aria-label={t('pages.dashboard.ariaGoToParent')}
                  >
                    <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                    <span>{t('pages.dashboard.btnUpToParent')}</span>
                  </button>
                )}

                {/* Directory List */}
                <div className="border border-border rounded-md max-h-64 overflow-y-auto bg-bg">
                  {discoverLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Spinner size="md" label={t('pages.dashboard.spinnerLoadingDirectories')} />
                    </div>
                  ) : !discoverData || discoverData.directories.length === 0 ? (
                    <div className="flex items-center justify-center py-8 text-fg-muted text-sm">
                      {t('pages.dashboard.emptyNoSubdirectories')}
                    </div>
                  ) : (
                    <ul className="divide-y divide-border">
                      {discoverData.directories.map((dir) => (
                        <li key={dir.path}>
                          <button
                            type="button"
                            onClick={() => handleDirectoryClick(dir)}
                            className="w-full px-3 py-2.5 text-left flex items-center gap-3 hover:bg-bg-hover transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                            aria-label={
                              dir.registered
                                ? t('pages.dashboard.ariaAlreadyAdded', { name: dir.name })
                                : t('pages.dashboard.ariaNavigateInto', { name: dir.name })
                            }
                          >
                            <svg
                              className="w-5 h-5 text-fg-muted flex-shrink-0"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                              />
                            </svg>
                            <span className="flex-1 truncate font-medium text-fg">{dir.name}</span>
                            {dir.registered && (
                              <Badge variant="success" className="flex-shrink-0">
                                {t('pages.dashboard.badgeAdded')}
                              </Badge>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Library Name Input for Selected Folder */}
                <Input
                  id="selectedLibraryName"
                  label={t('pages.dashboard.labelSelectedLibraryName')}
                  value={selectedFolderName}
                  onChange={(e) => setSelectedFolderName(e.target.value)}
                  placeholder={t('pages.dashboard.placeholderEnterLibraryName')}
                  disabled={discoverLoading}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={handleDialogClose}>
              {t('common.cancel')}
            </Button>
            {mode === 'create' ? (
              <Button onClick={handleCreateLibrary} disabled={creating}>
                {creating ? t('common.creating') : t('common.create')}
              </Button>
            ) : (
              <Button
                onClick={handleAddExistingLibrary}
                disabled={
                  creating ||
                  discoverLoading ||
                  !discoverPath.trim() ||
                  !selectedFolderName.trim() ||
                  isCurrentFolderRegistered()
                }
              >
                {creating ? t('common.adding') : t('pages.dashboard.btnAddThisFolder')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
