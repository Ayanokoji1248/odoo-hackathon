"""users: split name, add phone city country additional_info

Registration now collects first name, last name, email, phone, city, country and
free-text additional information, so `users.name` splits in two and four columns
arrive.

The split is done as add -> backfill -> enforce NOT NULL -> drop, not as a plain
DROP/ADD: existing accounts (including the seeded demo user) keep their names.
`split_part` on the first space puts "Demo Traveller" into ("Demo", "Traveller");
a single-word name leaves `last_name` empty rather than failing the NOT NULL.

Revision ID: 638f8090ac82
Revises: d8f0eaddea68
Create Date: 2026-08-22 14:05:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '638f8090ac82'
down_revision: str | None = 'd8f0eaddea68'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Add nullable, so the ALTER succeeds on a populated table.
    op.add_column('users', sa.Column('first_name', sa.String(length=60), nullable=True))
    op.add_column('users', sa.Column('last_name', sa.String(length=60), nullable=True))

    # 2. Backfill from the column being retired. Everything before the first
    #    space is the first name, everything after it is the last name.
    op.execute(
        """
        UPDATE users SET
            first_name = left(split_part(name, ' ', 1), 60),
            last_name  = left(
                trim(substring(name from position(' ' in name || ' ') + 1)), 60
            )
        """
    )
    # A name with no space leaves last_name = '' rather than NULL, so step 3 holds.
    op.execute("UPDATE users SET first_name = '-' WHERE first_name IS NULL OR first_name = ''")
    op.execute("UPDATE users SET last_name = '' WHERE last_name IS NULL")

    # 3. Now that every row has a value, enforce it.
    op.alter_column('users', 'first_name', nullable=False)
    op.alter_column('users', 'last_name', nullable=False)

    # 4. The new optional fields. `phone` is UNIQUE - the schema layer normalises
    #    to digits before insert, or the same number stores several ways and the
    #    constraint enforces nothing.
    op.add_column('users', sa.Column('phone', sa.String(length=32), nullable=True))
    op.add_column('users', sa.Column('city', sa.String(length=120), nullable=True))
    op.add_column('users', sa.Column('country', sa.String(length=120), nullable=True))
    op.add_column('users', sa.Column('additional_info', sa.Text(), nullable=True))
    op.create_unique_constraint(op.f('uq_users_phone'), 'users', ['phone'])

    # 5. Only now drop the old column - if anything above failed, the data is
    #    still there and the transaction rolls back intact.
    op.drop_column('users', 'name')


def downgrade() -> None:
    op.add_column('users', sa.Column('name', sa.String(length=120), nullable=True))
    op.execute("UPDATE users SET name = left(trim(first_name || ' ' || last_name), 120)")
    op.alter_column('users', 'name', nullable=False)

    op.drop_constraint(op.f('uq_users_phone'), 'users', type_='unique')
    op.drop_column('users', 'additional_info')
    op.drop_column('users', 'country')
    op.drop_column('users', 'city')
    op.drop_column('users', 'phone')
    op.drop_column('users', 'last_name')
    op.drop_column('users', 'first_name')
