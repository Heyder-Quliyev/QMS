import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  completeChecklist,
  getChecklistInstance,
  getChecklistInstances,
  patchChecklistItem,
} from '../services/checklistApi';
import type { UpdateChecklistItemPayload } from '../types';

export function useChecklistInstances() {
  return useQuery({
    queryKey: ['checklistInstances'],
    queryFn: getChecklistInstances,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });
}

export function useChecklistInstance(id: number | null | undefined) {
  return useQuery({
    queryKey: ['checklistInstance', id],
    queryFn: () => getChecklistInstance(id!),
    enabled: id != null,
    refetchOnWindowFocus: false,
    staleTime: 15_000,
  });
}

export function useUpdateChecklistItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      instanceId,
      itemId,
      payload,
    }: {
      instanceId: number;
      itemId: number;
      payload: UpdateChecklistItemPayload;
    }) => patchChecklistItem(instanceId, itemId, payload),

    onMutate: async ({ instanceId, itemId, payload }) => {
      await queryClient.cancelQueries({
        queryKey: ['checklistInstance', instanceId],
      });
      const previous = queryClient.getQueryData<any>([
        'checklistInstance',
        instanceId,
      ]);

      if (previous && previous.items) {
        const next = {
          ...previous,
          items: previous.items.map((it: any) =>
            it.id === itemId
              ? {
                  ...it,
                  result: payload.result ?? it.result,
                  numericValue:
                    payload.numericValue !== undefined
                      ? payload.numericValue
                      : it.numericValue,
                  notes:
                    payload.notes !== undefined ? payload.notes : it.notes,
                  photoPath:
                    payload.photoPath !== undefined
                      ? payload.photoPath
                      : it.photoPath,
                }
              : it,
          ),
        };
        queryClient.setQueryData(['checklistInstance', instanceId], next);
      }
      return { previous };
    },

    onError: (_err, { instanceId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ['checklistInstance', instanceId],
          context.previous,
        );
      }
    },

    onSuccess: (_data, { instanceId, itemId, payload }) => {
      // Refetch the single instance to resolve backend's auto-evaluated numeric result
      // (since numeric items get Pass/Fail assigned server-side)
      void queryClient.invalidateQueries({
        queryKey: ['checklistInstance', instanceId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['checklistInstances'],
      });
      void itemId;
      void payload;
    },
  });
}

export function useCompleteChecklist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (instanceId: number) => completeChecklist(instanceId),
    onSuccess: (_d, instanceId) => {
      void queryClient.invalidateQueries({
        queryKey: ['checklistInstance', instanceId],
      });
      void queryClient.invalidateQueries({ queryKey: ['checklistInstances'] });
    },
  });
}
