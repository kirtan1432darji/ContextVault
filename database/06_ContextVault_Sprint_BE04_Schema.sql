-- ============================================================================
-- ContextVault — Sprint BE-04 Schema Migration Script
-- Purpose: Context Generation Engine & Folder Knowledge Tables
-- Engine: Microsoft SQL Server 2022+ / Azure SQL Database
-- Revision: 003_context_generation
-- ============================================================================

USE [ContextVault];
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- ----------------------------------------------------------------------------
-- 1. Table: FolderContexts
-- ----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'FolderContexts')
BEGIN
    CREATE TABLE [dbo].[FolderContexts] (
        [Id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        [FolderId] UNIQUEIDENTIFIER NOT NULL,
        [UserId] UNIQUEIDENTIFIER NOT NULL,
        [Summary] NVARCHAR(MAX) NOT NULL,
        [TopicsJson] NVARCHAR(MAX) NOT NULL DEFAULT N'[]',
        [EntitiesJson] NVARCHAR(MAX) NOT NULL DEFAULT N'{}',
        [TasksJson] NVARCHAR(MAX) NOT NULL DEFAULT N'[]',
        [TimelineJson] NVARCHAR(MAX) NOT NULL DEFAULT N'[]',
        [Confidence] FLOAT NOT NULL DEFAULT 0.0,
        [Version] INT NOT NULL DEFAULT 1,
        [ScreenshotsAnalyzed] INT NOT NULL DEFAULT 0,
        [GeneratedOn] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        [IsDeleted] BIT NOT NULL DEFAULT 0,
        [CreatedOn] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        [UpdatedOn] DATETIME2 NULL,
        [DeletedOn] DATETIME2 NULL,

        CONSTRAINT [PK_FolderContexts] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [FK_FolderContexts_Categories] FOREIGN KEY ([FolderId]) REFERENCES [dbo].[Categories] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_FolderContexts_Users] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users] ([Id]) ON DELETE NO ACTION
    );
    PRINT 'Table [dbo].[FolderContexts] created.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_FolderContexts_FolderId' AND object_id = OBJECT_ID('FolderContexts'))
    CREATE NONCLUSTERED INDEX [IX_FolderContexts_FolderId] ON [dbo].[FolderContexts] ([FolderId] ASC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_FolderContexts_UserId' AND object_id = OBJECT_ID('FolderContexts'))
    CREATE NONCLUSTERED INDEX [IX_FolderContexts_UserId] ON [dbo].[FolderContexts] ([UserId] ASC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_FolderContexts_GeneratedOn' AND object_id = OBJECT_ID('FolderContexts'))
    CREATE NONCLUSTERED INDEX [IX_FolderContexts_GeneratedOn] ON [dbo].[FolderContexts] ([GeneratedOn] DESC);
GO

-- ----------------------------------------------------------------------------
-- 2. Table: ContextInsights
-- ----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ContextInsights')
BEGIN
    CREATE TABLE [dbo].[ContextInsights] (
        [Id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        [FolderContextId] UNIQUEIDENTIFIER NOT NULL,
        [InsightType] NVARCHAR(50) NOT NULL,
        [Value] NVARCHAR(MAX) NOT NULL,
        [Confidence] FLOAT NOT NULL DEFAULT 1.0,
        [CreatedOn] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT [PK_ContextInsights] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [FK_ContextInsights_FolderContexts] FOREIGN KEY ([FolderContextId]) REFERENCES [dbo].[FolderContexts] ([Id]) ON DELETE CASCADE
    );
    PRINT 'Table [dbo].[ContextInsights] created.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ContextInsights_FolderContextId' AND object_id = OBJECT_ID('ContextInsights'))
    CREATE NONCLUSTERED INDEX [IX_ContextInsights_FolderContextId] ON [dbo].[ContextInsights] ([FolderContextId] ASC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ContextInsights_InsightType' AND object_id = OBJECT_ID('ContextInsights'))
    CREATE NONCLUSTERED INDEX [IX_ContextInsights_InsightType] ON [dbo].[ContextInsights] ([InsightType] ASC);
GO

-- ----------------------------------------------------------------------------
-- 3. Table: EntityOccurrences
-- ----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'EntityOccurrences')
BEGIN
    CREATE TABLE [dbo].[EntityOccurrences] (
        [Id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        [Entity] NVARCHAR(260) NOT NULL,
        [EntityType] NVARCHAR(50) NOT NULL,
        [ScreenshotId] UNIQUEIDENTIFIER NOT NULL,
        [FolderId] UNIQUEIDENTIFIER NOT NULL,
        [Count] INT NOT NULL DEFAULT 1,
        [CreatedOn] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT [PK_EntityOccurrences] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [FK_EntityOccurrences_Screenshots] FOREIGN KEY ([ScreenshotId]) REFERENCES [dbo].[Screenshots] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_EntityOccurrences_Categories] FOREIGN KEY ([FolderId]) REFERENCES [dbo].[Categories] ([Id]) ON DELETE NO ACTION
    );
    PRINT 'Table [dbo].[EntityOccurrences] created.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EntityOccurrences_Entity' AND object_id = OBJECT_ID('EntityOccurrences'))
    CREATE NONCLUSTERED INDEX [IX_EntityOccurrences_Entity] ON [dbo].[EntityOccurrences] ([Entity] ASC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EntityOccurrences_EntityType' AND object_id = OBJECT_ID('EntityOccurrences'))
    CREATE NONCLUSTERED INDEX [IX_EntityOccurrences_EntityType] ON [dbo].[EntityOccurrences] ([EntityType] ASC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EntityOccurrences_ScreenshotId' AND object_id = OBJECT_ID('EntityOccurrences'))
    CREATE NONCLUSTERED INDEX [IX_EntityOccurrences_ScreenshotId] ON [dbo].[EntityOccurrences] ([ScreenshotId] ASC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EntityOccurrences_FolderId' AND object_id = OBJECT_ID('EntityOccurrences'))
    CREATE NONCLUSTERED INDEX [IX_EntityOccurrences_FolderId] ON [dbo].[EntityOccurrences] ([FolderId] ASC);
GO

PRINT 'Sprint BE-04 Schema Migration completed successfully.';
GO
