# Rollback

Frontend rollback target: `rollback/v0.2.0/index.html` or the previous Git commit/tag.

Important:
- v0.3 database data must not be deleted when rolling back frontend code.
- Database migrations are additive; do not drop tables as a quick rollback.
- Preserve Supabase backup/database before destructive schema changes in future releases.
- v0.2 localStorage is not automatically deleted by v0.3 migration.
