import { Brain, FolderGit2, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
    <div className="flex-1 flex flex-col">
      {!currentLibrary ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <FolderGit2 className="w-16 h-16 text-fg-subtle mx-auto mb-4" />
            <h2 className="text-xl font-medium text-fg">No Library Selected</h2>
            <p className="text-fg-muted mt-2">Create or select a library to get started</p>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="btn-primary mt-4"
            >
              <Plus className="w-4 h-4 inline mr-2" /> Create Library
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-fg">{currentLibrary.name}</h1>
                <p className="text-sm text-fg-muted">{currentLibrary.path}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" className="btn-ghost p-2" title="Search">
                  <Search className="w-5 h-5" />
                </button>
                <button type="button" className="btn-ghost p-2" title="AI Assistant">
                  <Brain className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="btn-primary px-3 py-1.5 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  New Library
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-4xl text-center py-12">
              <FolderGit2 className="w-24 h-24 text-fg-subtle mx-auto mb-6" />
              <h2 className="text-2xl font-medium text-fg mb-2">
                Welcome to {currentLibrary.name}
              </h2>
              <p className="text-fg-muted mb-8 max-w-md mx-auto leading-relaxed">
                Start by creating a new note or browsing the file tree on the left sidebar. Use the
                AI assistant in the right sidebar for help with your notes.
              </p>
              <div className="flex items-center justify-center gap-4">
                <button type="button" onClick={handleNewNote} className="btn-primary px-6 py-3">
                  <Plus className="w-5 h-5" />
                  New Note
                </button>
                <button type="button" className="btn-secondary px-6 py-3">
                  <Search className="w-5 h-5" />
                  Browse Files
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="card shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-fg mb-4">Create New Library</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="libraryName" className="block text-sm font-medium text-fg mb-1">
                  Library Name
                </label>
                <input
                  id="libraryName"
                  value={newLibraryName}
                  onChange={(e) => setNewLibraryName(e.target.value)}
                  placeholder="My Notes"
                  className="input-base"
                />
              </div>
              <div>
                <label htmlFor="libraryPath" className="block text-sm font-medium text-fg mb-1">
                  Folder Path (relative to /data)
                </label>
                <input
                  id="libraryPath"
                  value={newLibraryPath}
                  onChange={(e) => setNewLibraryPath(e.target.value)}
                  placeholder="my-notes"
                  className="input-base"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateLibrary}
                disabled={creating}
                className="btn-primary"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
