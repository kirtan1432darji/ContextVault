-- ============================================================================
-- ContextVault — Sprint BE-05 Schema Migration Script
-- Purpose: Context AI Chat Engine & Multi-Turn Conversation History
-- Engine: Microsoft SQL Server 2022+ / Azure SQL Database
-- Revision: 004_chat_engine
-- ============================================================================

USE [ContextVault];
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- ----------------------------------------------------------------------------
-- 1. Table: ChatSessions
-- ----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ChatSessions')
BEGIN
    CREATE TABLE [dbo].[ChatSessions] (
        [Id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        [UserId] UNIQUEIDENTIFIER NOT NULL,
        [FolderId] UNIQUEIDENTIFIER NULL,
        [Title] NVARCHAR(200) NULL,
        [IsDeleted] BIT NOT NULL DEFAULT 0,
        [CreatedOn] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        [UpdatedOn] DATETIME2 NULL,
        [DeletedOn] DATETIME2 NULL,

        CONSTRAINT [PK_ChatSessions] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [FK_ChatSessions_Users] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ChatSessions_Categories] FOREIGN KEY ([FolderId]) REFERENCES [dbo].[Categories] ([Id]) ON DELETE SET NULL
    );
    PRINT 'Table [dbo].[ChatSessions] created.';
END
GO

-- ----------------------------------------------------------------------------
-- 2. Table: ChatMessages
-- ----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ChatMessages')
BEGIN
    CREATE TABLE [dbo].[ChatMessages] (
        [Id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        [SessionId] UNIQUEIDENTIFIER NOT NULL,
        [UserId] UNIQUEIDENTIFIER NOT NULL,
        [FolderId] UNIQUEIDENTIFIER NULL,
        [ScreenshotId] UNIQUEIDENTIFIER NULL,
        [Role] NVARCHAR(20) NOT NULL,
        [Message] NVARCHAR(MAX) NOT NULL,
        [CitationsJson] NVARCHAR(MAX) NULL DEFAULT N'[]',
        [PromptTokens] INT NULL,
        [CompletionTokens] INT NULL,
        [AIModelId] UNIQUEIDENTIFIER NULL,
        [IsDeleted] BIT NOT NULL DEFAULT 0,
        [CreatedOn] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        [UpdatedOn] DATETIME2 NULL,
        [DeletedOn] DATETIME2 NULL,

        CONSTRAINT [PK_ChatMessages] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [FK_ChatMessages_Sessions] FOREIGN KEY ([SessionId]) REFERENCES [dbo].[ChatSessions] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_ChatMessages_Users] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ChatMessages_Categories] FOREIGN KEY ([FolderId]) REFERENCES [dbo].[Categories] ([Id]) ON DELETE SET NULL,
        CONSTRAINT [FK_ChatMessages_Screenshots] FOREIGN KEY ([ScreenshotId]) REFERENCES [dbo].[Screenshots] ([Id]) ON DELETE SET NULL,
        CONSTRAINT [CK_ChatMessages_Role] CHECK ([Role] IN ('User', 'Assistant', 'System', 'user', 'assistant', 'system'))
    );
    PRINT 'Table [dbo].[ChatMessages] created.';
END
GO

-- ----------------------------------------------------------------------------
-- 3. Performance & Retrieval Indexes
-- ----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ChatSessions_User' AND object_id = OBJECT_ID('ChatSessions'))
    CREATE NONCLUSTERED INDEX [IX_ChatSessions_User] ON [dbo].[ChatSessions] ([UserId] ASC, [CreatedOn] DESC) WHERE [IsDeleted] = 0;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ChatSessions_Folder' AND object_id = OBJECT_ID('ChatSessions'))
    CREATE NONCLUSTERED INDEX [IX_ChatSessions_Folder] ON [dbo].[ChatSessions] ([FolderId] ASC) WHERE [IsDeleted] = 0 AND [FolderId] IS NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ChatMessages_User_Session' AND object_id = OBJECT_ID('ChatMessages'))
    CREATE NONCLUSTERED INDEX [IX_ChatMessages_User_Session] ON [dbo].[ChatMessages] ([UserId] ASC, [SessionId] ASC, [CreatedOn] ASC) WHERE [IsDeleted] = 0;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ChatMessages_User_Folder' AND object_id = OBJECT_ID('ChatMessages'))
    CREATE NONCLUSTERED INDEX [IX_ChatMessages_User_Folder] ON [dbo].[ChatMessages] ([UserId] ASC, [FolderId] ASC, [CreatedOn] ASC) WHERE [IsDeleted] = 0;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ChatMessages_ScreenshotId' AND object_id = OBJECT_ID('ChatMessages'))
    CREATE NONCLUSTERED INDEX [IX_ChatMessages_ScreenshotId] ON [dbo].[ChatMessages] ([ScreenshotId] ASC) WHERE [IsDeleted] = 0 AND [ScreenshotId] IS NOT NULL;
GO

PRINT 'Sprint BE-05 Schema Migration completed successfully.';
GO
