"""004_chat_history_engine

Revision ID: 004_chat_history
Revises: 003_context_generation
Create Date: 2026-09-08 21:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '004_chat_history'
down_revision: Union[str, None] = '003_context_generation'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. ChatHistories table
    op.create_table(
        'ChatHistories',
        sa.Column('Id', sa.Uuid(), nullable=False),
        sa.Column('SessionId', sa.Uuid(), nullable=False),
        sa.Column('UserId', sa.Uuid(), nullable=False),
        sa.Column('CategoryId', sa.Uuid(), nullable=True),
        sa.Column('ScreenshotId', sa.Uuid(), nullable=True),
        sa.Column('Role', sa.String(length=20), nullable=False),
        sa.Column('Message', sa.Text(), nullable=False),
        sa.Column('ReferencedScreenshotIdsJson', sa.Text(), server_default='[]', nullable=True),
        sa.Column('PromptTokens', sa.Integer(), nullable=True),
        sa.Column('CompletionTokens', sa.Integer(), nullable=True),
        sa.Column('AIModelId', sa.Uuid(), nullable=True),
        sa.Column('IsDeleted', sa.Boolean(), server_default=sa.text('0'), nullable=False),
        sa.Column('CreatedOn', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('UpdatedOn', sa.DateTime(), nullable=True),
        sa.Column('DeletedOn', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['UserId'], ['Users.Id'], ondelete='NO ACTION'),
        sa.ForeignKeyConstraint(['CategoryId'], ['Categories.Id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['ScreenshotId'], ['Screenshots.Id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('Id')
    )
    op.create_index(op.f('ix_ChatHistories_SessionId'), 'ChatHistories', ['SessionId'], unique=False)
    op.create_index(op.f('ix_ChatHistories_UserId'), 'ChatHistories', ['UserId'], unique=False)
    op.create_index(op.f('ix_ChatHistories_CategoryId'), 'ChatHistories', ['CategoryId'], unique=False)
    op.create_index(op.f('ix_ChatHistories_ScreenshotId'), 'ChatHistories', ['ScreenshotId'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_ChatHistories_ScreenshotId'), table_name='ChatHistories')
    op.drop_index(op.f('ix_ChatHistories_CategoryId'), table_name='ChatHistories')
    op.drop_index(op.f('ix_ChatHistories_UserId'), table_name='ChatHistories')
    op.drop_index(op.f('ix_ChatHistories_SessionId'), table_name='ChatHistories')
    op.drop_table('ChatHistories')
