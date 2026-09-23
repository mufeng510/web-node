import { Brain, ChevronLeft, ChevronRight, FolderGit2, Plus, Search } from 'lucide-react';
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
import { IconButton } from '../components/ui/IconButton';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';
import { type DiscoverDirectory, type DiscoverResult, useLibraries } from '../hooks/useLibraries';

export function Dashboard() {
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
      navigate(`/editor/${currentLibrary.id}`);
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
    if (!path) return [{ name: 'Root', path: '' }];
    const parts = path.split('/');
    const segments = [{ name: 'Root', path: '' }];
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
          title="No Library Selected"
          description="Create or select a library to get started"
          actions={
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4" aria-hidden="true" /> Create Library
            </Button>
          }
        />
      ) : (
        <>
          <PageHeader
            title={currentLibrary.name}
            description={currentLibrary.path}
            actions={
              <>
                <IconButton aria-label="Search">
                  <Search className="w-5 h-5" />
                </IconButton>
                <IconButton aria-label="AI Assistant">
                  <Brain className="w-5 h-5" />
                </IconButton>
                <Button size="sm" onClick={() => setShowCreateModal(true)}>
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  New Library
                </Button>
              </>
            }
          />

          <EmptyState
            icon={FolderGit2}
            title={`Welcome to ${currentLibrary.name}`}
            description="Start by creating a new note or browsing the file tree on the left sidebar. Use the AI assistant in the right sidebar for help with your notes."
            actions={
              <>
                <Button size="lg" onClick={handleNewNote}>
                  <Plus className="w-5 h-5" aria-hidden="true" />
                  New Note
                </Button>
                <Button variant="secondary" size="lg">
                  <Search className="w-5 h-5" aria-hidden="true" />
                  Browse Files
                </Button>
              </>
            }
          />
        </>
      )}

      <Dialog open={showCreateModal} onOpenChange={handleDialogClose}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Add Library</DialogTitle>
            <DialogDescription>
              {mode === 'create'
                ? 'Create a new library by specifying a name and folder path'
                : 'Browse and select an existing folder under /data to register as a library'}
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
                Create new
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
                Select existing
              </button>
            </div>

            {/* Create New Mode */}
            {mode === 'create' && (
              <div className="space-y-4">
                <Input
                  id="libraryName"
                  label="Library Name"
                  value={newLibraryName}
                  onChange={(e) => setNewLibraryName(e.target.value)}
                  placeholder="My Notes"
                />
                <Input
                  id="libraryPath"
                  label="Folder Path (relative to /data)"
                  value={newLibraryPath}
                  onChange={(e) => setNewLibraryPath(e.target.value)}
                  placeholder="my-notes"
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
                        aria-label={segment.path ? `Go to ${segment.path}` : 'Go to root'}
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
                    aria-label="Go to parent directory"
                  >
                    <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                    <span>Up to parent</span>
                  </button>
                )}

                {/* Directory List */}
                <div className="border border-border rounded-md max-h-64 overflow-y-auto bg-bg">
                  {discoverLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Spinner size="md" label="Loading directories" />
                    </div>
                  ) : !discoverData || discoverData.directories.length === 0 ? (
                    <div className="flex items-center justify-center py-8 text-fg-muted text-sm">
                      No subdirectories
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
                                ? `${dir.name}, already added as library`
                                : `Navigate into ${dir.name}`
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
                                Added
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
                  label="Library Name"
                  value={selectedFolderName}
                  onChange={(e) => setSelectedFolderName(e.target.value)}
                  placeholder="Enter library name"
                  disabled={discoverLoading}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={handleDialogClose}>
              Cancel
            </Button>
            {mode === 'create' ? (
              <Button onClick={handleCreateLibrary} disabled={creating}>
                {creating ? 'Creating...' : 'Create'}
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
                {creating ? 'Adding...' : 'Add this folder'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
