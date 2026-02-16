-- Remove duplicate roulette spin ledger grants (keep earliest row per student + source_id).
with ranked as (
  select
    id,
    student_id,
    source_id,
    row_number() over (
      partition by student_id, source_id
      order by created_at asc, id asc
    ) as rn
  from public.ledger
  where source_type = 'roulette_spin'
    and source_id is not null
)
delete from public.ledger l
using ranked r
where l.id = r.id
  and r.rn > 1;

-- Add uniqueness guard to prevent duplicate roulette spin grants.
create unique index if not exists ledger_roulette_spin_unique_grant_idx
  on public.ledger (student_id, source_id)
  where source_type = 'roulette_spin'
    and source_id is not null;
