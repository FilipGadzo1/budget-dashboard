import { supabase } from '@/lib/supabase'
import type {
  ActivityEntry,
  Collaboration,
  CollaborationRole,
  InviteInfo,
  SharedBudget,
} from '@/models'

// ─── Collaborators on my budget ───────────────────────────────────────────────

export async function fetchMyCollaborators(userId: string): Promise<Collaboration[]> {
  const { data, error } = await supabase
    .from('collaborations')
    .select('id, owner_id, owner_email, owner_name, collaborator_email, collaborator_id, collaborator_name, role, status, invite_token, created_at, updated_at')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.warn('[collab] fetchMyCollaborators error:', error.message)
    return []
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    ownerId: row.owner_id,
    ownerEmail: row.owner_email,
    ownerName: row.owner_name ?? '',
    collaboratorEmail: row.collaborator_email,
    collaboratorId: row.collaborator_id,
    collaboratorName: row.collaborator_name,
    role: row.role as CollaborationRole,
    status: row.status as Collaboration['status'],
    inviteToken: row.invite_token,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

// ─── Budgets shared with me ───────────────────────────────────────────────────

export async function fetchSharedWithMe(userId: string): Promise<SharedBudget[]> {
  const { data, error } = await supabase
    .from('collaborations')
    .select('id, owner_id, owner_email, owner_name, collaborator_email, role, status, invite_token, owner_currency_code, owner_locale')
    .or(`collaborator_id.eq.${userId},collaborator_id.is.null`)
    .neq('owner_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.warn('[collab] fetchSharedWithMe error:', error.message)
    return []
  }

  // Note: pending rows (collaborator_id = null) are matched server-side by email via RLS.
  // Client-side we just render what we received.
  return (data ?? []).map((row) => ({
    collaborationId: row.id,
    ownerId: row.owner_id,
    ownerEmail: row.owner_email,
    ownerName: row.owner_name ?? '',
    collaboratorEmail: row.collaborator_email,
    role: row.role as CollaborationRole,
    status: row.status as SharedBudget['status'],
    inviteToken: row.invite_token,
    ownerCurrencyCode: (row.owner_currency_code as string | null) ?? 'EUR',
    ownerLocale: (row.owner_locale as string | null) ?? 'en-IE',
  }))
}

// ─── Invite management ────────────────────────────────────────────────────────

export async function inviteCollaborator(
  ownerId: string,
  ownerEmail: string,
  ownerName: string,
  collaboratorEmail: string,
  role: CollaborationRole,
  ownerCurrencyCode: string,
  ownerLocale: string,
): Promise<Collaboration> {
  const { data, error } = await supabase
    .from('collaborations')
    .insert({
      owner_id: ownerId,
      owner_email: ownerEmail,
      owner_name: ownerName,
      collaborator_email: collaboratorEmail.toLowerCase().trim(),
      role,
      owner_currency_code: ownerCurrencyCode,
      owner_locale: ownerLocale,
    })
    .select('id, owner_id, owner_email, owner_name, collaborator_email, collaborator_id, collaborator_name, role, status, invite_token, created_at, updated_at')
    .single()

  if (error) {
    // Unique constraint violation: already invited
    if (error.code === '23505') throw new Error('This person has already been invited.')
    throw new Error(error.message)
  }

  return {
    id: data.id,
    ownerId: data.owner_id,
    ownerEmail: data.owner_email,
    ownerName: data.owner_name ?? '',
    collaboratorEmail: data.collaborator_email,
    collaboratorId: data.collaborator_id,
    collaboratorName: data.collaborator_name,
    role: data.role as CollaborationRole,
    status: data.status as Collaboration['status'],
    inviteToken: data.invite_token,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

export async function revokeCollaborator(collaborationId: string): Promise<void> {
  const { error } = await supabase
    .from('collaborations')
    .delete()
    .eq('id', collaborationId)

  if (error) console.warn('[collab] revokeCollaborator error:', error.message)
}

export async function updateCollaboratorRole(
  collaborationId: string,
  role: CollaborationRole,
): Promise<void> {
  const { error } = await supabase
    .from('collaborations')
    .update({ role })
    .eq('id', collaborationId)

  if (error) console.warn('[collab] updateCollaboratorRole error:', error.message)
}

// ─── Accept / Decline invite ──────────────────────────────────────────────────

export async function acceptInvite(
  collaborationId: string,
  userId: string,
  userName: string,
): Promise<void> {
  const { error } = await supabase
    .from('collaborations')
    .update({
      status: 'accepted',
      collaborator_id: userId,
      collaborator_name: userName,
    })
    .eq('id', collaborationId)

  if (error) console.warn('[collab] acceptInvite error:', error.message)
}

export async function declineInvite(collaborationId: string): Promise<void> {
  const { error } = await supabase
    .from('collaborations')
    .update({ status: 'declined' })
    .eq('id', collaborationId)

  if (error) console.warn('[collab] declineInvite error:', error.message)
}

// ─── Fetch invite by token (public, for invite link flow) ─────────────────────

export async function fetchInviteByToken(token: string): Promise<InviteInfo | null> {
  const { data, error } = await supabase
    .rpc('get_invite_by_token', { p_token: token })

  if (error) {
    console.warn('[collab] fetchInviteByToken error:', error.message)
    return null
  }

  const row = data?.[0]
  if (!row) return null

  return {
    id: row.id,
    ownerId: row.owner_id,
    ownerEmail: row.owner_email,
    ownerName: row.owner_name ?? '',
    collaboratorEmail: row.collaborator_email,
    role: row.role as CollaborationRole,
    status: row.status as InviteInfo['status'],
  }
}

// ─── Activity Log ─────────────────────────────────────────────────────────────

export async function logActivity(
  budgetOwnerId: string,
  actorId: string,
  actorEmail: string,
  actorName: string,
  action: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await supabase.from('activity_log').insert({
    budget_owner_id: budgetOwnerId,
    actor_id: actorId,
    actor_email: actorEmail,
    actor_name: actorName,
    action,
    metadata,
  })

  if (error) console.warn('[collab] logActivity error:', error.message)
}

export async function fetchActivityLog(
  budgetOwnerId: string,
  limit = 20,
): Promise<ActivityEntry[]> {
  const { data, error } = await supabase
    .from('activity_log')
    .select('id, budget_owner_id, actor_id, actor_email, actor_name, action, metadata, created_at')
    .eq('budget_owner_id', budgetOwnerId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.warn('[collab] fetchActivityLog error:', error.message)
    return []
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    budgetOwnerId: row.budget_owner_id,
    actorId: row.actor_id,
    actorEmail: row.actor_email,
    actorName: row.actor_name,
    action: row.action,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.created_at,
  }))
}
