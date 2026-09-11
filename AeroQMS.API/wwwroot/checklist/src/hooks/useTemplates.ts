import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createTemplate,
  deleteTemplate,
  getTemplate,
  getTemplates,
  updateTemplate,
} from '../services/templateApi';
import type { CreateTemplatePayload, UpdateTemplatePayload } from '../types';

export function useTemplates() {
  return useQuery({
    queryKey: ['checklistTemplates'],
    queryFn: getTemplates,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });
}

export function useTemplate(id: number | null) {
  return useQuery({
    queryKey: ['checklistTemplate', id],
    queryFn: () => getTemplate(id!),
    enabled: id != null,
    refetchOnWindowFocus: false,
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTemplatePayload) => createTemplate(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['checklistTemplates'] });
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateTemplatePayload }) =>
      updateTemplate(id, payload),
    onSuccess: (_d, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ['checklistTemplates'] });
      void queryClient.invalidateQueries({ queryKey: ['checklistTemplate', id] });
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteTemplate(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['checklistTemplates'] });
    },
  });
}
