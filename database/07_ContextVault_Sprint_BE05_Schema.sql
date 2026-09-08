-- ============================================================================
-- ContextVault — Sprint BE-05 Schema Migration Script
-- Purpose: Context AI Chat Engine & Multi-Turn Conversation History
-- Engine: Microsoft SQL Server 2022+ / Azure SQL Database
-- Revision: 004_chat_history
-- ============================================================================

USE [ContextVault];
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- ----------------------------------------------------------------------------
-- 1. Table: ChatHistories
-- ----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ChatHistories')
BEGIN
    CREATE TABLE [dbo].[ChatHistories] (
        [Id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        [SessionId] UNIQUEIDENTIFIER NOT NULL,
        [UserId] UNIQUEIDENTIFIER NOT NULL,
        [CategoryId] UNIQUEIDENTIFIER NULL,
        [ScreenshotId] UNIQUEIDENTIFIER NULL,
        [Role] NVARCHAR(20) NOT NULL,
        [Message] NVARCHAR(MAX) NOT NULL,
        [ReferencedScreenshotIdsJson] NVARCHAR(MAX) NULL DEFAULT N'[]',
        [PromptTokens] INT NULL,
        [CompletionTokens] INT NULL,
        [AIModelId] UNIQUEIDENTIFIER NULL,
        [IsDeleted] BIT NOT NULL DEFAULT 0,
        [CreatedOn] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        [UpdatedOn] DATETIME2 NULL,
        [DeletedOn] DATETIME2 NULL,

        CONSTRAINT [PK_ChatHistories] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [FK_ChatHistories_Users] FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ChatHistories_Categories] FOREIGN KEY ([CategoryId]) REFERENCES [dbo].[Categories] ([Id]) ON DELETE SET NULL,
        CONSTRAINT [FK_ChatHistories_Screenshots] FOREIGN KEY ([ScreenshotId]) REFERENCES [dbo].[Screenshots] ([Id]) ON DELETE SET NULL,
        CONSTRAINT [CK_ChatHistories_Role] CHECK ([Role] IN ('User', 'Assistant', 'System', 'user', 'assistant', 'system'))
    );
    PRINT 'Table [dbo].[ChatHistories] created.';
END
GO

-- ----------------------------------------------------------------------------
-- 2. Performance & Retrieval Indexes
-- ----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ChatHistories_User_Session' AND object_id = OBJECT_ID('ChatHistories'))
    CREATE NONCLUSTERED INDEX [IX_ChatHistories_User_Session] ON [dbo].[ChatHistories] ([UserId] ASC, [SessionId] ASC, [CreatedOn] ASC) WHERE [IsDeleted] = 0;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ChatHistories_User_Category' AND object_id = OBJECT_ID('ChatHistories'))
    CREATE NONCLUSTERED INDEX [IX_ChatHistories_User_Category] ON [dbo].[ChatHistories] ([UserId] ASC, [CategoryId] ASC, [CreatedOn] ASC) WHERE [IsDeleted] = 0;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ChatHistories_ScreenshotId' AND object_id = OBJECT_ID('ChatHistories'))
    CREATE NONCLUSTERED INDEX [IX_ChatHistories_ScreenshotId] ON [dbo].[ChatHistories] ([ScreenshotId] ASC) WHERE [IsDeleted] = 0 AND [ScreenshotId] IS NOT NULL;
GO

PRINT 'Sprint BE-05 Schema Migration completed successfully.';
GO
