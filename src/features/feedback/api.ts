import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import type { Feedback, FeedbackKind } from '@/features/feedback/logic';
import { requireSupabase } from '@/lib/supabase';

export const feedbackKeys = { list: ['feedback'] as const, reader: ['feedbackReader'] as const };

/** What you've sent, or everyone's if you're a reader (newest first). */
export function useFeedbackList() {
  const { session } = useAuth();
  return useQuery({
    queryKey: feedbackKeys.list,
    enabled: Boolean(session),
    queryFn: async (): Promise<Feedback[]> => {
      const { data, error } = await requireSupabase().from('feedback').select('*').order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      return (data ?? []) as Feedback[];
    },
  });
}

/** True when this account can read everyone's feedback (it's in feedback_readers). */
export function useFeedbackReader() {
  const { session } = useAuth();
  return useQuery({
    queryKey: feedbackKeys.reader,
    enabled: Boolean(session),
    // Checked each time the screen opens, so adding yourself in SQL shows straight away.
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await requireSupabase().rpc('can_read_all_feedback');
      // Before the SQL is run there's no function: nobody is a reader.
      if (error) return false;
      return data === true;
    },
  });
}

export type NewFeedback = { kind: FeedbackKind; message: string; screen: string | null; app_version: string; device: string };

export function useSendFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewFeedback) => {
      // Who sent it is stamped by the database, never taken from the app.
      const { error } = await requireSupabase()
        .from('feedback')
        .insert({ ...input, message: input.message.trim() });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: feedbackKeys.list }),
  });
}
