"""catalog: cities, activities, saved destinations

Revision ID: 2d720df8abd1
Revises: dae7f6738b4c
Create Date: 2026-08-22 09:31:53.324367

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2d720df8abd1'
down_revision: str | None = 'dae7f6738b4c'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # pg_trgm backs the GIN indexes that keep `name ILIKE '%foo%'` off a table scan.
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.create_table('cities',
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('country', sa.String(length=80), nullable=False),
    sa.Column('region', sa.String(length=80), nullable=True),
    sa.Column('latitude', sa.Numeric(precision=9, scale=6), nullable=True),
    sa.Column('longitude', sa.Numeric(precision=9, scale=6), nullable=True),
    sa.Column('cost_index', sa.SmallInteger(), nullable=False),
    sa.Column('popularity_score', sa.Integer(), server_default=sa.text('0'), nullable=False),
    sa.Column('image_url', sa.Text(), nullable=True),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint('cost_index BETWEEN 1 AND 100', name=op.f('ck_cities_cost_index_range')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_cities')),
    sa.UniqueConstraint('name', 'country', name=op.f('uq_cities_name_country'))
    )
    op.create_index('ix_cities_country', 'cities', ['country'], unique=False)
    op.create_index('ix_cities_name_trgm', 'cities', ['name'], unique=False, postgresql_using='gin', postgresql_ops={'name': 'gin_trgm_ops'})
    op.create_index('ix_cities_popularity_score_desc', 'cities', [sa.text('popularity_score DESC')], unique=False)
    op.create_table('activities',
    sa.Column('city_id', sa.UUID(), nullable=False),
    sa.Column('name', sa.String(length=160), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('category', sa.Enum('SIGHTSEEING', 'FOOD', 'ADVENTURE', 'CULTURE', 'NIGHTLIFE', 'SHOPPING', 'RELAXATION', 'TRANSPORT', name='activity_category'), nullable=False),
    sa.Column('estimated_cost', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('currency', sa.CHAR(length=3), nullable=False),
    sa.Column('duration_minutes', sa.Integer(), nullable=True),
    sa.Column('image_url', sa.Text(), nullable=True),
    sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint('duration_minutes > 0', name=op.f('ck_activities_duration_minutes_positive')),
    sa.CheckConstraint('estimated_cost >= 0', name=op.f('ck_activities_estimated_cost_non_negative')),
    sa.ForeignKeyConstraint(['city_id'], ['cities.id'], name=op.f('fk_activities_city_id_cities'), ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_activities')),
    sa.UniqueConstraint('city_id', 'name', name=op.f('uq_activities_city_id_name'))
    )
    op.create_index('ix_activities_city_id_category', 'activities', ['city_id', 'category'], unique=False)
    op.create_index('ix_activities_estimated_cost', 'activities', ['estimated_cost'], unique=False)
    op.create_index('ix_activities_name_trgm', 'activities', ['name'], unique=False, postgresql_using='gin', postgresql_ops={'name': 'gin_trgm_ops'})
    op.create_table('saved_destinations',
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('city_id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['city_id'], ['cities.id'], name=op.f('fk_saved_destinations_city_id_cities'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_saved_destinations_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('user_id', 'city_id', name=op.f('pk_saved_destinations'))
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    op.drop_table('saved_destinations')
    op.drop_index('ix_activities_name_trgm', table_name='activities', postgresql_using='gin', postgresql_ops={'name': 'gin_trgm_ops'})
    op.drop_index('ix_activities_estimated_cost', table_name='activities')
    op.drop_index('ix_activities_city_id_category', table_name='activities')
    op.drop_table('activities')
    op.drop_index('ix_cities_popularity_score_desc', table_name='cities')
    op.drop_index('ix_cities_name_trgm', table_name='cities', postgresql_using='gin', postgresql_ops={'name': 'gin_trgm_ops'})
    op.drop_index('ix_cities_country', table_name='cities')
    op.drop_table('cities')
    # create_table creates the enum type; drop_table does not remove it.
    sa.Enum(name='activity_category').drop(op.get_bind())
