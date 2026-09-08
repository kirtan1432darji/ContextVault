"""001_initial_auth_tables

Revision ID: 001_initial_auth
Revises: 
Create Date: 2026-09-06 13:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '001_initial_auth'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Users table
    op.create_table(
        'Users',
        sa.Column('Id', sa.Uuid(), nullable=False),
        sa.Column('Username', sa.String(length=100), nullable=False),
        sa.Column('Email', sa.String(length=256), nullable=False),
        sa.Column('PasswordHash', sa.String(length=256), nullable=False),
        sa.Column('IsActive', sa.Boolean(), server_default=sa.text('1'), nullable=False),
        sa.Column('IsDeleted', sa.Boolean(), server_default=sa.text('0'), nullable=False),
        sa.Column('CreatedOn', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('UpdatedOn', sa.DateTime(), nullable=True),
        sa.Column('CreatedBy', sa.Uuid(), nullable=True),
        sa.Column('UpdatedBy', sa.Uuid(), nullable=True),
        sa.Column('DeletedOn', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('Id')
    )
    op.create_index(op.f('ix_Users_Email'), 'Users', ['Email'], unique=True)
    op.create_index(op.f('ix_Users_Username'), 'Users', ['Username'], unique=True)

    # 2. RefreshTokens table
    op.create_table(
        'RefreshTokens',
        sa.Column('Id', sa.Uuid(), nullable=False),
        sa.Column('UserId', sa.Uuid(), nullable=False),
        sa.Column('Token', sa.String(length=500), nullable=False),
        sa.Column('ExpiresAt', sa.DateTime(), nullable=False),
        sa.Column('IsRevoked', sa.Boolean(), server_default=sa.text('0'), nullable=False),
        sa.Column('CreatedOn', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('UpdatedOn', sa.DateTime(), nullable=True),
        sa.Column('CreatedBy', sa.Uuid(), nullable=True),
        sa.Column('UpdatedBy', sa.Uuid(), nullable=True),
        sa.Column('DeletedOn', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['UserId'], ['Users.Id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('Id')
    )
    op.create_index(op.f('ix_RefreshTokens_Token'), 'RefreshTokens', ['Token'], unique=True)
    op.create_index(op.f('ix_RefreshTokens_UserId'), 'RefreshTokens', ['UserId'], unique=False)

    # 3. AppSettings table
    op.create_table(
        'AppSettings',
        sa.Column('Id', sa.Uuid(), nullable=False),
        sa.Column('UserId', sa.Uuid(), nullable=True),
        sa.Column('SettingKey', sa.String(length=100), nullable=False),
        sa.Column('SettingValue', sa.Text(), nullable=False),
        sa.Column('DataType', sa.String(length=50), server_default='String', nullable=False),
        sa.Column('Description', sa.String(length=500), nullable=True),
        sa.Column('IsDeleted', sa.Boolean(), server_default=sa.text('0'), nullable=False),
        sa.Column('CreatedOn', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('UpdatedOn', sa.DateTime(), nullable=True),
        sa.Column('CreatedBy', sa.Uuid(), nullable=True),
        sa.Column('UpdatedBy', sa.Uuid(), nullable=True),
        sa.Column('DeletedOn', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['UserId'], ['Users.Id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('Id')
    )
    op.create_index(op.f('ix_AppSettings_SettingKey'), 'AppSettings', ['SettingKey'], unique=False)
    op.create_index(op.f('ix_AppSettings_UserId'), 'AppSettings', ['UserId'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_AppSettings_UserId'), table_name='AppSettings')
    op.drop_index(op.f('ix_AppSettings_SettingKey'), table_name='AppSettings')
    op.drop_table('AppSettings')

    op.drop_index(op.f('ix_RefreshTokens_UserId'), table_name='RefreshTokens')
    op.drop_index(op.f('ix_RefreshTokens_Token'), table_name='RefreshTokens')
    op.drop_table('RefreshTokens')

    op.drop_index(op.f('ix_Users_Username'), table_name='Users')
    op.drop_index(op.f('ix_Users_Email'), table_name='Users')
    op.drop_table('Users')
