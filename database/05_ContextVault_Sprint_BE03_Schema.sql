-- ============================================================================
-- ContextVault — Sprint BE-03 Schema & Seed Migration Script
-- Purpose: Screenshot Intelligence & AI Classification Engine Tables
-- Engine: Microsoft SQL Server 2022+ / Azure SQL Database
-- Revision: 002_screenshot_classification
-- ============================================================================

USE [ContextVault];
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- ----------------------------------------------------------------------------
-- 1. Table: Categories
-- ----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Categories')
BEGIN
    CREATE TABLE [dbo].[Categories] (
        [Id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        [UserId] UNIQUEIDENTIFIER NULL,
        [ParentCategoryId] UNIQUEIDENTIFIER NULL,
        [Name] NVARCHAR(100) NOT NULL,
        [Path] NVARCHAR(500) NOT NULL,
        [Icon] NVARCHAR(100) NOT NULL DEFAULT N'folder-outline',
        [Color] NVARCHAR(50) NOT NULL DEFAULT N'#6366F1',
        [IsSystem] BIT NOT NULL DEFAULT 1,
        [ScreenshotCount] INT NOT NULL DEFAULT 0,
        [DisplayOrder] INT NOT NULL DEFAULT 0,
        [Description] NVARCHAR(500) NULL,
        [IsDeleted] BIT NOT NULL DEFAULT 0,
        [CreatedOn] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        [UpdatedOn] DATETIME2 NULL,
        [DeletedOn] DATETIME2 NULL,

        CONSTRAINT [PK_Categories] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [FK_Categories_Users] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Categories_ParentCategory] FOREIGN KEY ([ParentCategoryId]) REFERENCES [dbo].[Categories] ([Id]) ON DELETE NO ACTION
    );
    PRINT 'Table [dbo].[Categories] created.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Categories_UserId' AND object_id = OBJECT_ID('Categories'))
    CREATE NONCLUSTERED INDEX [IX_Categories_UserId] ON [dbo].[Categories] ([UserId] ASC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Categories_ParentCategoryId' AND object_id = OBJECT_ID('Categories'))
    CREATE NONCLUSTERED INDEX [IX_Categories_ParentCategoryId] ON [dbo].[Categories] ([ParentCategoryId] ASC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Categories_Path' AND object_id = OBJECT_ID('Categories'))
    CREATE NONCLUSTERED INDEX [IX_Categories_Path] ON [dbo].[Categories] ([Path] ASC);
GO

-- ----------------------------------------------------------------------------
-- 2. Table: Tags
-- ----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Tags')
BEGIN
    CREATE TABLE [dbo].[Tags] (
        [Id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        [Name] NVARCHAR(100) NOT NULL,
        [Color] NVARCHAR(50) NOT NULL DEFAULT N'#6366F1',
        [UserId] UNIQUEIDENTIFIER NULL,
        [CreatedOn] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT [PK_Tags] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [FK_Tags_Users] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users] ([Id]) ON DELETE NO ACTION
    );
    PRINT 'Table [dbo].[Tags] created.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Tags_Name' AND object_id = OBJECT_ID('Tags'))
    CREATE UNIQUE NONCLUSTERED INDEX [IX_Tags_Name] ON [dbo].[Tags] ([Name] ASC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Tags_UserId' AND object_id = OBJECT_ID('Tags'))
    CREATE NONCLUSTERED INDEX [IX_Tags_UserId] ON [dbo].[Tags] ([UserId] ASC);
GO

-- ----------------------------------------------------------------------------
-- 3. Table: Screenshots
-- ----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Screenshots')
BEGIN
    CREATE TABLE [dbo].[Screenshots] (
        [Id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        [UserId] UNIQUEIDENTIFIER NOT NULL,
        [CategoryId] UNIQUEIDENTIFIER NULL,
        [SubCategory] NVARCHAR(100) NULL,
        [FileName] NVARCHAR(260) NOT NULL,
        [OCRText] NVARCHAR(MAX) NULL,
        [NormalizedText] NVARCHAR(MAX) NULL,
        [SHA256Hash] NVARCHAR(64) NOT NULL,
        [DeviceFolder] NVARCHAR(260) NULL,
        [DetectedApp] NVARCHAR(100) NULL,
        [Width] INT NOT NULL DEFAULT 1080,
        [Height] INT NOT NULL DEFAULT 2400,
        [MimeType] NVARCHAR(50) NOT NULL DEFAULT N'image/png',
        [Confidence] FLOAT NOT NULL DEFAULT 0.0,
        [IsFavorite] BIT NOT NULL DEFAULT 0,
        [IsReviewed] BIT NOT NULL DEFAULT 0,
        [IsDeleted] BIT NOT NULL DEFAULT 0,
        [CreatedOn] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        [UpdatedOn] DATETIME2 NULL,
        [DeletedOn] DATETIME2 NULL,

        CONSTRAINT [PK_Screenshots] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [FK_Screenshots_Users] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Screenshots_Categories] FOREIGN KEY ([CategoryId]) REFERENCES [dbo].[Categories] ([Id]) ON DELETE SET NULL
    );
    PRINT 'Table [dbo].[Screenshots] created.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Screenshots_UserId' AND object_id = OBJECT_ID('Screenshots'))
    CREATE NONCLUSTERED INDEX [IX_Screenshots_UserId] ON [dbo].[Screenshots] ([UserId] ASC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Screenshots_CategoryId' AND object_id = OBJECT_ID('Screenshots'))
    CREATE NONCLUSTERED INDEX [IX_Screenshots_CategoryId] ON [dbo].[Screenshots] ([CategoryId] ASC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Screenshots_SHA256Hash' AND object_id = OBJECT_ID('Screenshots'))
    CREATE NONCLUSTERED INDEX [IX_Screenshots_SHA256Hash] ON [dbo].[Screenshots] ([SHA256Hash] ASC);
GO

-- ----------------------------------------------------------------------------
-- 4. Table: ScreenshotTags (Many-to-Many Bridge)
-- ----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ScreenshotTags')
BEGIN
    CREATE TABLE [dbo].[ScreenshotTags] (
        [ScreenshotId] UNIQUEIDENTIFIER NOT NULL,
        [TagId] UNIQUEIDENTIFIER NOT NULL,
        [CreatedOn] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT [PK_ScreenshotTags] PRIMARY KEY CLUSTERED ([ScreenshotId] ASC, [TagId] ASC),
        CONSTRAINT [FK_ScreenshotTags_Screenshots] FOREIGN KEY ([ScreenshotId]) REFERENCES [dbo].[Screenshots] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_ScreenshotTags_Tags] FOREIGN KEY ([TagId]) REFERENCES [dbo].[Tags] ([Id]) ON DELETE CASCADE
    );
    PRINT 'Table [dbo].[ScreenshotTags] created.';
END
GO

-- ----------------------------------------------------------------------------
-- 5. Table: ClassificationHistory (Audit Ledger)
-- ----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ClassificationHistory')
BEGIN
    CREATE TABLE [dbo].[ClassificationHistory] (
        [Id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        [ScreenshotId] UNIQUEIDENTIFIER NOT NULL,
        [UserId] UNIQUEIDENTIFIER NOT NULL,
        [Category] NVARCHAR(100) NOT NULL,
        [SubCategory] NVARCHAR(100) NULL,
        [TagsJson] NVARCHAR(MAX) NULL,
        [EntitiesJson] NVARCHAR(MAX) NULL,
        [Confidence] FLOAT NOT NULL DEFAULT 0.0,
        [ModelName] NVARCHAR(100) NOT NULL DEFAULT N'RuleEngine-v1.0',
        [CreatedOn] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT [PK_ClassificationHistory] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [FK_ClassificationHistory_Screenshots] FOREIGN KEY ([ScreenshotId]) REFERENCES [dbo].[Screenshots] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_ClassificationHistory_Users] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users] ([Id]) ON DELETE NO ACTION
    );
    PRINT 'Table [dbo].[ClassificationHistory] created.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ClassificationHistory_ScreenshotId' AND object_id = OBJECT_ID('ClassificationHistory'))
    CREATE NONCLUSTERED INDEX [IX_ClassificationHistory_ScreenshotId] ON [dbo].[ClassificationHistory] ([ScreenshotId] ASC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ClassificationHistory_UserId' AND object_id = OBJECT_ID('ClassificationHistory'))
    CREATE NONCLUSTERED INDEX [IX_ClassificationHistory_UserId] ON [dbo].[ClassificationHistory] ([UserId] ASC);
GO

-- ----------------------------------------------------------------------------
-- 6. Table: SearchIndex
-- ----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'SearchIndex')
BEGIN
    CREATE TABLE [dbo].[SearchIndex] (
        [Id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        [ScreenshotId] UNIQUEIDENTIFIER NOT NULL,
        [UserId] UNIQUEIDENTIFIER NOT NULL,
        [SearchableContent] NVARCHAR(MAX) NOT NULL,
        [Keywords] NVARCHAR(MAX) NULL,
        [IndexedOn] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        [UpdatedOn] DATETIME2 NULL,

        CONSTRAINT [PK_SearchIndex] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [UQ_SearchIndex_ScreenshotId] UNIQUE ([ScreenshotId]),
        CONSTRAINT [FK_SearchIndex_Screenshots] FOREIGN KEY ([ScreenshotId]) REFERENCES [dbo].[Screenshots] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_SearchIndex_Users] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users] ([Id]) ON DELETE NO ACTION
    );
    PRINT 'Table [dbo].[SearchIndex] created.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SearchIndex_UserId' AND object_id = OBJECT_ID('SearchIndex'))
    CREATE NONCLUSTERED INDEX [IX_SearchIndex_UserId] ON [dbo].[SearchIndex] ([UserId] ASC);
GO

-- ----------------------------------------------------------------------------
-- 7. Seed Canonical Smart Folders (Idempotent)
-- ----------------------------------------------------------------------------
DECLARE @CategoriesToSeed TABLE (
    [Name] NVARCHAR(100),
    [Icon] NVARCHAR(100),
    [Color] NVARCHAR(50),
    [DisplayOrder] INT,
    [Description] NVARCHAR(500)
);

INSERT INTO @CategoriesToSeed ([Name], [Icon], [Color], [DisplayOrder], [Description])
VALUES
    (N'Receipts & Invoices', N'receipt-outline', N'#10B981', 1, N'Bills, orders, invoices, payment confirmations'),
    (N'Finance & Banking', N'bank-outline', N'#3B82F6', 2, N'Bank statements, UPI, crypto, tax, portfolios'),
    (N'Projects / Work', N'briefcase-outline', N'#8B5CF6', 3, N'Multi-tier project tasks, specs, milestones, payroll'),
    (N'Shopping & Wishlist', N'cart-outline', N'#F97316', 4, N'E-commerce products, shoes, electronics, wishlist items'),
    (N'Code & Tech', N'code-braces', N'#F59E0B', 5, N'GitHub snippets, stack traces, terminal logs, API configs'),
    (N'Social & Chat', N'chat-outline', N'#EC4899', 6, N'WhatsApp, Telegram, Discord, Instagram, Twitter/X'),
    (N'Documents & IDs', N'card-account-details-outline', N'#06B6D4', 7, N'Passports, driver licenses, identity cards, contracts'),
    (N'Travel & Tickets', N'airplane', N'#14B8A6', 8, N'Flight boarding passes, train bookings, hotel vouchers'),
    (N'Notes & Knowledge', N'book-open-outline', N'#6366F1', 9, N'Articles, recipes, learning materials, study notes'),
    (N'Memes & Humor', N'emoticon-happy-outline', N'#EAB308', 10, N'Jokes, snapshots, comedy cards'),
    (N'Unsorted', N'folder-question-outline', N'#94A3B8', 11, N'Awaiting OCR processing or low-confidence review');

MERGE [dbo].[Categories] AS target
USING @CategoriesToSeed AS src
ON target.[Name] = src.[Name] AND target.[ParentCategoryId] IS NULL AND target.[IsSystem] = 1
WHEN MATCHED THEN
    UPDATE SET 
        target.[Icon] = src.[Icon],
        target.[Color] = src.[Color],
        target.[DisplayOrder] = src.[DisplayOrder],
        target.[Description] = src.[Description],
        target.[Path] = src.[Name]
WHEN NOT MATCHED THEN
    INSERT ([Id], [UserId], [ParentCategoryId], [Name], [Path], [Icon], [Color], [IsSystem], [ScreenshotCount], [DisplayOrder], [Description], [IsDeleted], [CreatedOn])
    VALUES (NEWID(), NULL, NULL, src.[Name], src.[Name], src.[Icon], src.[Color], 1, 0, src.[DisplayOrder], src.[Description], 0, SYSUTCDATETIME());

PRINT 'Canonical Smart Folder taxonomy verified & seeded.';
GO
