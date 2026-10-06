-- ════════════════════════════════════════════════════════════════════
-- VoiceDeck migration 0005
-- 1. Widen call_signals.type check: + 'mute', 'kick', 'close'
--    (the old DB constraint silently rejected moderation signals —
--    host kick/mute/end-call inserts failed with DB error)
-- 2. One-time cleanup: stale ghost room members (dead heartbeat > 3 min)
--    + empty active rooms older than 3 min
-- ════════════════════════════════════════════════════════════════════

-- ── 1. call_signals type check ──────────────────────────────────────
alter table public.call_signals drop constraint if exists call_signals_type_check;
alter table public.call_signals add constraint call_signals_type_check
  check (type = any (array[
    'offer'::text, 'answer'::text, 'ice'::text, 'join'::text, 'leave'::text,
    'mute'::text, 'kick'::text, 'close'::text
  ]));

-- ── 2. One-time ghost cleanup ───────────────────────────────────────
-- Members whose user heartbeat is older than 3 minutes are gone IRL.
delete from public.room_members m
using public.users u
where m.user_id = u.id
  and u.last_seen_at < now() - interval '3 minutes';

-- Close active rooms that have no members (and are old enough
-- that it is not a create→refetch race).
update public.rooms r
set is_active = false, closed_at = now()
where r.is_active = true
  and r.closed_at is null
  and r.created_at < now() - interval '3 minutes'
  and not exists (select 1 from public.room_members m where m.room_id = r.id);

-- Finish game sessions of closed rooms
update public.game_sessions gs
set phase = 'finished'
from public.rooms r
where gs.room_id = r.id
  and r.is_active = false;
