import { normalizeSupabaseUrl } from '@/lib/env';

describe('normalizeSupabaseUrl', () => {
  it('keeps a correct project URL as is', () => {
    expect(normalizeSupabaseUrl('https://abcdefghijklmnopqrst.supabase.co')).toBe('https://abcdefghijklmnopqrst.supabase.co');
  });

  it('strips the REST endpoint path and trailing slashes people often paste', () => {
    expect(normalizeSupabaseUrl('https://abcdefghijklmnopqrst.supabase.co/rest/v1/')).toBe(
      'https://abcdefghijklmnopqrst.supabase.co',
    );
    expect(normalizeSupabaseUrl(' https://abcdefghijklmnopqrst.supabase.co/ ')).toBe('https://abcdefghijklmnopqrst.supabase.co');
    expect(normalizeSupabaseUrl('https://abcdefghijklmnopqrst.supabase.co/auth/v1')).toBe(
      'https://abcdefghijklmnopqrst.supabase.co',
    );
  });
});
