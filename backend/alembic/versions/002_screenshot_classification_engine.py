"""002_screenshot_classification_engine

Revision ID: 002_screenshot_classification
Revises: 001_initial_auth
Create Date: 2026-09-06 14:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '002_screenshot_classification'
down_revision: Union[str, None] = '001_initial_auth'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Categories table
    op.create_table(
        'Categories',
        sa.Column('Id', sa.Uuid(), nullable=False),
        sa.Column('UserId', sa.Uuid(), nullable=True),
        sa.Column('ParentCategoryId', sa.Uuid(), nullable=True),
        sa.Column('Name', sa.String(length=100), nullable=False),
        sa.Column('Path', sa.String(length=500), nullable=False),
        sa.Column('Icon', sa.String(length=100), server_default='folder-outline', nullable=False),
        sa.Column('Color', sa.String(length=50), server_default='#6366F1', nullable=False),
        sa.Column('IsSystem', sa.Boolean(), server_default=sa.text('1'), nullable=False),
        sa.Column('ScreenshotCount', sa.Integer(), server_default=sa.text('0'), nullable=False),
        sa.Column('DisplayOrder', sa.Integer(), server_default=sa.text('0'), nullable=False),
        sa.Column('Description', sa.String(length=500), nullable=True),
        sa.Column('IsDeleted', sa.Boolean(), server_default=sa.text('0'), nullable=False),
        sa.Column('CreatedOn', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('UpdatedOn', sa.DateTime(), nullable=True),
        sa.Column('DeletedOn', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['UserId'], ['Users.Id'], ondelete='NO ACTION'),
        sa.ForeignKeyConstraint(['ParentCategoryId'], ['Categories.Id'], ondelete='NO ACTION'),
        sa.PrimaryKeyConstraint('Id')
    )
    op.create_index(op.f('ix_Categories_UserId'), 'Categories', ['UserId'], unique=False)
    op.create_index(op.f('ix_Categories_ParentCategoryId'), 'Categories', ['ParentCategoryId'], unique=False)
    op.create_index(op.f('ix_Categories_Path'), 'Categories', ['Path'], unique=False)

    # 2. Tags table
    op.create_table(
        'Tags',
        sa.Column('Id', sa.Uuid(), nullable=False),
        sa.Column('Name', sa.String(length=100), nullable=False),
        sa.Column('Color', sa.String(length=50), server_default='#6366F1', nullable=False),
        sa.Column('UserId', sa.Uuid(), nullable=True),
        sa.Column('CreatedOn', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['UserId'], ['Users.Id'], ondelete='NO ACTION'),
        sa.PrimaryKeyConstraint('Id')
    )
    op.create_index(op.f('ix_Tags_Name'), 'Tags', ['Name'], unique=True)
    op.create_index(op.f('ix_Tags_UserId'), 'Tags', ['UserId'], unique=False)

    # 3. Screenshots table
    op.create_table(
        'Screenshots',
        sa.Column('Id', sa.Uuid(), nullable=False),
        sa.Column('UserId', sa.Uuid(), nullable=False),
        sa.Column('CategoryId', sa.Uuid(), nullable=True),
        sa.Column('SubCategory', sa.String(length=100), nullable=True),
        sa.Column('FileName', sa.String(length=260), nullable=False),
        sa.Column('OCRText', sa.Text(), nullable=True),
        sa.Column('NormalizedText', sa.Text(), nullable=True),
        sa.Column('SHA256Hash', sa.String(length=64), nullable=False),
        sa.Column('DeviceFolder', sa.String(length=260), nullable=True),
        sa.Column('DetectedApp', sa.String(length=100), nullable=True),
        sa.Column('Width', sa.Integer(), server_default=sa.text('1080'), nullable=False),
        sa.Column('Height', sa.Integer(), server_default=sa.text('2400'), nullable=False),
        sa.Column('MimeType', sa.String(length=50), server_default='image/png', nullable=False),
        sa.Column('Confidence', sa.Float(), server_default=sa.text('0.0'), nullable=False),
        sa.Column('IsFavorite', sa.Boolean(), server_default=sa.text('0'), nullable=False),
        sa.Column('IsReviewed', sa.Boolean(), server_default=sa.text('0'), nullable=False),
        sa.Column('IsDeleted', sa.Boolean(), server_default=sa.text('0'), nullable=False),
        sa.Column('CreatedOn', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('UpdatedOn', sa.DateTime(), nullable=True),
        sa.Column('DeletedOn', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['CategoryId'], ['Categories.Id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['UserId'], ['Users.Id'], ondelete='NO ACTION'),
        sa.PrimaryKeyConstraint('Id')
    )
    op.create_index(op.f('ix_Screenshots_UserId'), 'Screenshots', ['UserId'], unique=False)
    op.create_index(op.f('ix_Screenshots_CategoryId'), 'Screenshots', ['CategoryId'], unique=False)
    op.create_index(op.f('ix_Screenshots_SHA256Hash'), 'Screenshots', ['SHA256Hash'], unique=False)

    # 4. ScreenshotTags table
    op.create_table(
        'ScreenshotTags',
        sa.Column('ScreenshotId', sa.Uuid(), nullable=False),
        sa.Column('TagId', sa.Uuid(), nullable=False),
        sa.Column('CreatedOn', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['ScreenshotId'], ['Screenshots.Id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['TagId'], ['Tags.Id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('ScreenshotId', 'TagId')
    )

    # 5. ClassificationHistory table
    op.create_table(
        'ClassificationHistory',
        sa.Column('Id', sa.Uuid(), nullable=False),
        sa.Column('ScreenshotId', sa.Uuid(), nullable=False),
        sa.Column('UserId', sa.Uuid(), nullable=False),
        sa.Column('Category', sa.String(length=100), nullable=False),
        sa.Column('SubCategory', sa.String(length=100), nullable=True),
        sa.Column('TagsJson', sa.Text(), nullable=True),
        sa.Column('EntitiesJson', sa.Text(), nullable=True),
        sa.Column('Confidence', sa.Float(), server_default=sa.text('0.0'), nullable=False),
        sa.Column('ModelName', sa.String(length=100), server_default='RuleEngine-v1.0', nullable=False),
        sa.Column('CreatedOn', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['ScreenshotId'], ['Screenshots.Id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['UserId'], ['Users.Id'], ondelete='NO ACTION'),
        sa.PrimaryKeyConstraint('Id')
    )
    op.create_index(op.f('ix_ClassificationHistory_ScreenshotId'), 'ClassificationHistory', ['ScreenshotId'], unique=False)
    op.create_index(op.f('ix_ClassificationHistory_UserId'), 'ClassificationHistory', ['UserId'], unique=False)

    # 6. SearchIndex table
    op.create_table(
        'SearchIndex',
        sa.Column('Id', sa.Uuid(), nullable=False),
        sa.Column('ScreenshotId', sa.Uuid(), nullable=False),
        sa.Column('UserId', sa.Uuid(), nullable=False),
        sa.Column('SearchableContent', sa.Text(), nullable=False),
        sa.Column('Keywords', sa.Text(), nullable=True),
        sa.Column('IndexedOn', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('UpdatedOn', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['ScreenshotId'], ['Screenshots.Id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['UserId'], ['Users.Id'], ondelete='NO ACTION'),
        sa.PrimaryKeyConstraint('Id')
    )
    op.create_index(op.f('ix_SearchIndex_ScreenshotId'), 'SearchIndex', ['ScreenshotId'], unique=True)
    op.create_index(op.f('ix_SearchIndex_UserId'), 'SearchIndex', ['UserId'], unique=False)


def downgrade() -> None:
    op.drop_table('SearchIndex')
    op.drop_table('ClassificationHistory')
    op.drop_table('ScreenshotTags')
    op.drop_table('Screenshots')
    op.drop_table('Tags')
    op.drop_table('Categories')
