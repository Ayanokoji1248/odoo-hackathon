"""sessions: rotation, revocation and device metadata

Grows the single-token session row into one that supports refresh-token
rotation, independent revocation, and a user-facing session list.

Written by hand rather than left as autogenerate produced it: autogenerate saw
`token_hash` -> `refresh_token_hash` as a DROP plus an ADD, which throws away
every live session *and* fails outright on a non-empty table, because the new
column is NOT NULL with no default. `alter_column(new_column_name=...)` renames
in place, so existing sessions survive the migration.

Revision ID: d8f0eaddea68
Revises: 7f1c4e0b93aa
Create Date: 2026-08-22 13:15:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd8f0eaddea68'
down_revision: str | None = '7f1c4e0b93aa'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Rename, don't recreate - live sessions keep working across the deploy.
    op.alter_column('sessions', 'token_hash', new_column_name='refresh_token_hash')
    op.drop_constraint(op.f('uq_sessions_token_hash'), 'sessions', type_='unique')
    op.create_unique_constraint(
        op.f('uq_sessions_refresh_token_hash'), 'sessions', ['refresh_token_hash']
    )

    # The previous token in the chain, plus when it was demoted. Together these
    # are the rotation grace window: a token presented here shortly after being
    # rotated is a concurrent request, not a replay.
    op.add_column('sessions', sa.Column('prev_refresh_token_hash', sa.String(length=64), nullable=True))
    op.add_column('sessions', sa.Column('rotated_at', sa.DateTime(timezone=True), nullable=True))
    op.create_unique_constraint(
        op.f('uq_sessions_prev_refresh_token_hash'), 'sessions', ['prev_refresh_token_hash']
    )

    # NULL means live. A revoked row is kept rather than deleted so /auth/refresh
    # can tell a deliberately killed session apart from an unknown token.
    op.add_column('sessions', sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True))

    # server_default fills existing rows, so NOT NULL is safe to add here.
    op.add_column(
        'sessions',
        sa.Column('last_used_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    # Device metadata for the session list. Nullable - a client need not send a UA.
    op.add_column('sessions', sa.Column('user_agent', sa.String(length=255), nullable=True))
    op.add_column('sessions', sa.Column('ip_address', postgresql.INET(), nullable=True))


def downgrade() -> None:
    op.drop_column('sessions', 'ip_address')
    op.drop_column('sessions', 'user_agent')
    op.drop_column('sessions', 'last_used_at')
    op.drop_column('sessions', 'revoked_at')
    op.drop_constraint(op.f('uq_sessions_prev_refresh_token_hash'), 'sessions', type_='unique')
    op.drop_column('sessions', 'rotated_at')
    op.drop_column('sessions', 'prev_refresh_token_hash')
    op.drop_constraint(op.f('uq_sessions_refresh_token_hash'), 'sessions', type_='unique')
    op.alter_column('sessions', 'refresh_token_hash', new_column_name='token_hash')
    op.create_unique_constraint(op.f('uq_sessions_token_hash'), 'sessions', ['token_hash'])
