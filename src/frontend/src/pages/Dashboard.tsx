import { Brain, FolderGit2, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { useLibraries } from '../hooks/useLibraries';

export function Dashboard() {
  const { libraries, currentLibrary, setCurrentLibrary, createLibrary, fetchLibraries } =
    useLibraries();
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

  if (!currentLibrary) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <FolderGit2 className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-medium text-gray-900 dark:text-white">No Library Selected</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            Create or select a library to get started
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4 inline mr-2" /> Create Library
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              {currentLibrary.name}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{currentLibrary.path}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Search"
            >
              <Search className="w-5 h-5" />
            </button>
            <button
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              title="AI Assistant"
            >
              <Brain className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              New Library
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-4xl text-center py-12">
          <FolderGit2 className="w-24 h-24 text-gray-300 dark:text-gray-600 mx-auto mb-6" />
          <h2 className="text-2xl font-medium text-gray-900 dark:text-white mb-2">
            Welcome to {currentLibrary.name}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto">
            Start by creating a new note or browsing the file tree on the left sidebar. Use the AI
            assistant in the right sidebar for help with your notes.
          </p>
          <div className="flex items-center justify-center gap-4">
            <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
              <Plus className="w-5 h-5" />
              New Note
            </button>
            <button className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2">
              <Search className="w-5 h-5" />
              Browse Files
            </button>
          </div>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold mb-4">Create New Library</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Library Name
                </label>
                <input
                  value={newLibraryName}
                  onChange={(e) => setNewLibraryName(e.target.value)}
                  placeholder="My Notes"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Folder Path (relative to /data)
                </label>
                <input
                  value={newLibraryPath}
                  onChange={(e) => setNewLibraryPath(e.target.value)}
                  placeholder="my-notes"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateLibrary}
                disabled={creating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
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
