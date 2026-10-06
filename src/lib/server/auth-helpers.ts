import { supabase, type UserRow } from '@/lib/supabase/client'

/**
 * Server-side helpers for API routes (never import from client code).
 */

/** Fetch the user row by id. Returns null if not found. */
export async function getUserById(id: number): Promise<UserRow | null> {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .maybeSingle<UserRow>()
  return data ?? null
}

/**
 * Anonymous accounts have limited functionality:
 * they cannot create rooms and cannot use voice calls.
 * Returns the user row if the action is allowed, null otherwise.
 */
export async function getUserAllowedForAction(
  id: number,
  action: 'create_room' | 'voice'
): Promise<UserRow | null> {
  const user = await getUserById(id)
  if (!user) return null
  if (user.account_type === 'anonymous') return null
  return user
}

export const ANON_ERROR =
  'Доступно только после выбора основного типа аккаунта (Telegram или Steam)'
