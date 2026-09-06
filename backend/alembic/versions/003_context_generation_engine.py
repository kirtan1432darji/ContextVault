"""003_context_generation_engine

Revision ID: 003_context_generation
Revises: 002_screenshot_classification
Create Date: 2026-09-06 14:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '003_context_generation'
down_revision: Union[str, None] = '002_screenshot_classification'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. FolderContexts table
    op.create_table(
        'FolderContexts',
        sa.Column('Id', sa.Uuid(), nullable=False),
        sa.Column('FolderId', sa.Uuid(), nullable=False),
        sa.Column('UserId', sa.Uuid(), nullable=False),
        sa.Column('Summary', sa.Text(), nullable=False),
        sa.Column('TopicsJson', sa.Text(), server_default='[]', nullable=False),
        sa.Column('EntitiesJson', sa.Text(), server_default='{}', nullable=False),
        sa.Column('TasksJson', sa.Text(), server_default='[]', nullable=False),
        sa.Column('TimelineJson', sa.Text(), server_default='[]', nullable=False),
        sa.Column('Confidence', sa.Float(), server_default=sa.text('0.0'), nullable=False),
        sa.Column('Version', sa.Integer(), server_default=sa.text('1'), nullable=False),
        sa.Column('ScreenshotsAnalyzed', sa.Integer(), server_default=sa.text('0'), nullable=False),
        sa.Column('GeneratedOn', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('IsDeleted', sa.Boolean(), server_default=sa.text('0'), nullable=False),
        sa.Column('CreatedOn', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('UpdatedOn', sa.DateTime(), nullable=True),
        sa.Column('DeletedOn', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['FolderId'], ['Categories.Id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['UserId'], ['Users.Id'], ondelete='NO ACTION'),
        sa.PrimaryKeyConstraint('Id')
    )
    op.create_index(op.f('ix_FolderContexts_FolderId'), 'FolderContexts', ['FolderId'], unique=False)
    op.create_index(op.f('ix_FolderContexts_UserId'), 'FolderContexts', ['UserId'], unique=False)

    # 2. ContextInsights table
    op.create_table(
        'ContextInsights',
        sa.Column('Id', sa.Uuid(), nullable=False),
        sa.Column('FolderContextId', sa.Uuid(), nullable=False),
        sa.Column('InsightType', sa.String(length=50), nullable=False),
        sa.Column('Value', sa.Text(), nullable=False),
        sa.Column('Confidence', sa.Float(), server_default=sa.text('1.0'), nullable=False),
        sa.Column('CreatedOn', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['FolderContextId'], ['FolderContexts.Id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('Id')
    )
    op.create_index(op.f('ix_ContextInsights_FolderContextId'), 'ContextInsights', ['FolderContextId'], unique=False)

    # 3. EntityOccurrences table
    op.create_table(
        'EntityOccurrences',
        sa.Column('Id', sa.Uuid(), nullable=False),
        sa.Column('Entity', sa.String(length=260), nullable=False),
        sa.Column('EntityType', sa.String(length=50), nullable=False),
        sa.Column('ScreenshotId', sa.Uuid(), nullable=False),
        sa.Column('FolderId', sa.Uuid(), nullable=False),
        sa.Column('Count', sa.Integer(), server_default=sa.text('1'), nullable=False),
        sa.Column('CreatedOn', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['ScreenshotId'], ['Screenshots.Id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['FolderId'], ['Categories.Id'], ondelete='NO ACTION'),
        sa.PrimaryKeyConstraint('Id')
    )
    op.create_index(op.f('ix_EntityOccurrences_Entity'), 'EntityOccurrences', ['Entity'], unique=False)
    op.create_index(op.f('ix_EntityOccurrences_EntityType'), 'EntityOccurrences', ['EntityType'], unique=False)
    op.create_index(op.f('ix_EntityOccurrences_ScreenshotId'), 'EntityOccurrences', ['ScreenshotId'], unique=False)
    op.create_index(op.f('ix_EntityOccurrences_FolderId'), 'EntityOccurrences', ['FolderId'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_EntityOccurrences_FolderId'), table_name='EntityOccurrences')
    op.drop_index(op.f('ix_EntityOccurrences_ScreenshotId'), table_name='EntityOccurrences')
    op.drop_index(op.f('ix_EntityOccurrences_EntityType'), table_name='EntityOccurrences')
    op.drop_index(op.f('ix_EntityOccurrences_Entity'), table_name='EntityOccurrences')
    op.drop_table('EntityOccurrences')

    op.drop_index(op.f('ix_ContextInsights_FolderContextId'), table_name='ContextInsights')
    op.drop_table('ContextInsights')

    op.drop_index(op.f('ix_FolderContexts_UserId'), table_name='FolderContexts')
    op.drop_index(op.f('ix_FolderContexts_FolderId'), table_name='FolderContexts')
    op.drop_table('FolderContexts')
