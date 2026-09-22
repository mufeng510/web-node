import { Brain, FolderGit2, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/Dialog';
import { EmptyState } from '../components/ui/EmptyState';
import { IconButton } from '../components/ui/IconButton';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { useLibraries } from '../hooks/useLibraries';

export function Dashboard() {
  const { currentLibrary, createLibrary } = useLibraries();
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newLibraryName, setNewLibraryName] = useState('');
  const [newLibraryPath, setNewLibraryPath] = useState('');
  const [creating, setCreating] = useState(false);

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

      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Create New Library</DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-4">
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
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateLibrary} disabled={creating}>
              {creating ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
