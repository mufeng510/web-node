import { type ReactNode, createContext, useContext, useEffect, useState } from 'react';
import { api } from '../services/api';

interface Library {
  id: string;
  name: string;
  path: string;
  ownerId: string;
  config: any;
  createdAt: string;
  updatedAt: string;
}

export interface DiscoverDirectory {
  name: string;
  path: string;
  registered: boolean;
  libraryId: string | null;
}

export interface DiscoverResult {
  currentPath: string;
  parentPath: string | null;
  currentRegistered: boolean;
  directories: DiscoverDirectory[];
}

interface LibraryContextType {
  libraries: Library[];
  currentLibrary: Library | null;
  loading: boolean;
  fetchLibraries: () => Promise<void>;
  setCurrentLibrary: (library: Library | null) => void;
  createLibrary: (data: any) => Promise<Library>;
  updateLibrary: (id: string, data: any) => Promise<void>;
  deleteLibrary: (id: string) => Promise<void>;
  discoverLibraryDirs: (path?: string) => Promise<DiscoverResult>;
}

const LibraryContext = createContext<LibraryContextType | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [currentLibrary, setCurrentLibraryState] = useState<Library | null>(null);
  const [loading, setLoading] = useState(false);

  const setCurrentLibrary = (library: Library | null) => {
    setCurrentLibraryState(library);
    if (library) {
      localStorage.setItem('currentLibraryId', library.id);
    } else {
      localStorage.removeItem('currentLibraryId');
    }
  };

  const fetchLibraries = async () => {
    setLoading(true);
    try {
      const response = await api.get('/libraries');
      if (response.success) {
        setLibraries(response.data);
        const saved = localStorage.getItem('currentLibraryId');
        if (saved) {
          const lib = response.data.find((l: Library) => l.id === saved);
          if (lib) setCurrentLibrary(lib);
        } else if (response.data.length > 0) {
          setCurrentLibrary(response.data[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch libraries:', error);
    } finally {
      setLoading(false);
    }
  };

  const createLibrary = async (data: any) => {
    const response = await api.post('/libraries', data);
    if (response.success) {
      await fetchLibraries();
      return response.data;
    }
    throw new Error(response.error?.message || 'Failed to create library');
  };

  const updateLibrary = async (id: string, data: any) => {
    const response = await api.patch(`/libraries/${id}`, data);
    if (response.success) {
      await fetchLibraries();
    } else {
      throw new Error(response.error?.message || 'Failed to update library');
    }
  };

  const deleteLibrary = async (id: string) => {
    const response = await api.delete(`/libraries/${id}`);
    if (response.success) {
      await fetchLibraries();
    } else {
      throw new Error(response.error?.message || 'Failed to delete library');
    }
  };

  const discoverLibraryDirs = async (path?: string): Promise<DiscoverResult> => {
    const response = (await api.get('/libraries/discover', {
      params: { path },
    })) as unknown as {
      success: boolean;
      data: DiscoverResult;
      error?: { message?: string };
    };
    if (response.success) {
      return response.data;
    }
    throw new Error(response.error?.message || 'Failed to discover directories');
  };

  useEffect(() => {
    fetchLibraries();
  }, []);

  return (
    <LibraryContext.Provider
      value={{
        libraries,
        currentLibrary,
        loading,
        fetchLibraries,
        setCurrentLibrary,
        createLibrary,
        updateLibrary,
        deleteLibrary,
        discoverLibraryDirs,
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibraries() {
  const context = useContext(LibraryContext);
  if (!context) {
    throw new Error('useLibraries must be used within a LibraryProvider');
  }
  return context;
}
