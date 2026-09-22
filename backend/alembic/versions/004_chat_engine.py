"""004_chat_engine

Revision ID: 004_chat_engine
Revises: 003_context_generation
Create Date: 2026-09-08 21:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '004_chat_engine'
down_revision: Union[str, None] = '003_context_generation'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. ChatSessions table
    op.create_table(
        'ChatSessions',
        sa.Column('Id', sa.Uuid(), nullable=False),
        sa.Column('UserId', sa.Uuid(), nullable=False),
        sa.Column('FolderId', sa.Uuid(), nullable=True),
        sa.Column('Title', sa.String(length=200), nullable=True),
        sa.Column('IsDeleted', sa.Boolean(), server_default=sa.text('0'), nullable=False),
        sa.Column('CreatedOn', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('UpdatedOn', sa.DateTime(), nullable=True),
        sa.Column('DeletedOn', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['UserId'], ['Users.Id'], ondelete='NO ACTION'),
        sa.ForeignKeyConstraint(['FolderId'], ['Categories.Id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('Id')
    )
    op.create_index(op.f('ix_ChatSessions_UserId'), 'ChatSessions', ['UserId'], unique=False)
    op.create_index(op.f('ix_ChatSessions_FolderId'), 'ChatSessions', ['FolderId'], unique=False)

    # 2. ChatMessages table
    op.create_table(
        'ChatMessages',
        sa.Column('Id', sa.Uuid(), nullable=False),
        sa.Column('SessionId', sa.Uuid(), nullable=False),
        sa.Column('UserId', sa.Uuid(), nullable=False),
        sa.Column('FolderId', sa.Uuid(), nullable=True),
        sa.Column('ScreenshotId', sa.Uuid(), nullable=True),
        sa.Column('Role', sa.String(length=20), nullable=False),
        sa.Column('Message', sa.Text(), nullable=False),
        sa.Column('CitationsJson', sa.Text(), server_default='[]', nullable=True),
        sa.Column('PromptTokens', sa.Integer(), nullable=True),
        sa.Column('CompletionTokens', sa.Integer(), nullable=True),
        sa.Column('AIModelId', sa.Uuid(), nullable=True),
        sa.Column('IsDeleted', sa.Boolean(), server_default=sa.text('0'), nullable=False),
        sa.Column('CreatedOn', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('UpdatedOn', sa.DateTime(), nullable=True),
        sa.Column('DeletedOn', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['SessionId'], ['ChatSessions.Id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['UserId'], ['Users.Id'], ondelete='NO ACTION'),
        sa.ForeignKeyConstraint(['FolderId'], ['Categories.Id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['ScreenshotId'], ['Screenshots.Id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('Id')
    )
    op.create_index(op.f('ix_ChatMessages_SessionId'), 'ChatMessages', ['SessionId'], unique=False)
    op.create_index(op.f('ix_ChatMessages_UserId'), 'ChatMessages', ['UserId'], unique=False)
    op.create_index(op.f('ix_ChatMessages_FolderId'), 'ChatMessages', ['FolderId'], unique=False)
    op.create_index(op.f('ix_ChatMessages_ScreenshotId'), 'ChatMessages', ['ScreenshotId'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_ChatMessages_ScreenshotId'), table_name='ChatMessages')
    op.drop_index(op.f('ix_ChatMessages_FolderId'), table_name='ChatMessages')
    op.drop_index(op.f('ix_ChatMessages_UserId'), table_name='ChatMessages')
    op.drop_index(op.f('ix_ChatMessages_SessionId'), table_name='ChatMessages')
    op.drop_table('ChatMessages')

    op.drop_index(op.f('ix_ChatSessions_FolderId'), table_name='ChatSessions')
    op.drop_index(op.f('ix_ChatSessions_UserId'), table_name='ChatSessions')
    op.drop_table('ChatSessions')
