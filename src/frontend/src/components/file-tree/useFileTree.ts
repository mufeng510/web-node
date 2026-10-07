import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';

export interface TreeNode {
  id: string;
  name: string;
  path: string;
  relativePath: string;
  isDir: boolean;
  size: number;
  mimeType?: string;
  mtime: string;
  children?: TreeNode[];
  hidden?: boolean;
}

interface TreeResponse {
  success: boolean;
  data: { tree: TreeNode[] };
}

export function useFileTree(libraryId: string | undefined) {
  const query = useQuery({
    queryKey: ['file-tree', libraryId],
    enabled: Boolean(libraryId),
    queryFn: async () => {
      const response = (await api.get(`/files/${libraryId}/tree`)) as unknown as TreeResponse;
      if (!response.success) throw new Error('Failed to load file tree');
      return response.data.tree;
    },
  });

  return {
    tree: query.data ?? [],
    // `isPending` stays true forever for a disabled query, which would leave the
    // tree spinning when there is no library. `isLoading` accounts for `isFetching`.
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
