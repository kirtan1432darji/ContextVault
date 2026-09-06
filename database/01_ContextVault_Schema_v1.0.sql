-- ============================================================================
-- ContextVault Database Architecture v1.0
-- Script 01: Production Schema DDL (Tables, Constraints, Indexes, Audit Standards)
-- Target DBMS: Microsoft SQL Server 2022+ / Azure SQL / LocalDB
-- Note: Idempotent script; does not DROP tables or databases.
-- ============================================================================

USE [AIScreenshotOrganizerDb];
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- 1. Create AI Schema if not exists
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = N'ai')
BEGIN
    EXEC('CREATE SCHEMA [ai]');
END
GO

-- ============================================================================
-- 2. EVOLVE EXISTING TABLES TO MEET AUDIT STANDARDS
-- ============================================================================

-- Users: Ensure audit columns exist
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Users]') AND name = N'CreatedOn')
BEGIN
    ALTER TABLE [dbo].[Users] ADD [CreatedOn] datetime2(7) NOT NULL CONSTRAINT DF_Users_CreatedOn DEFAULT SYSUTCDATETIME();
    ALTER TABLE [dbo].[Users] ADD [UpdatedOn] datetime2(7) NULL;
    ALTER TABLE [dbo].[Users] ADD [CreatedBy] uniqueidentifier NULL;
    ALTER TABLE [dbo].[Users] ADD [UpdatedBy] uniqueidentifier NULL;
    ALTER TABLE [dbo].[Users] ADD [DeletedOn] datetime2(7) NULL;
    ALTER TABLE [dbo].[Users] ADD [RowVersion] rowversion NOT NULL;
END
GO

-- Categories: Ensure audit columns, Description & DisplayOrder exist
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Categories]') AND name = N'CreatedOn')
BEGIN
    ALTER TABLE [dbo].[Categories] ADD [CreatedOn] datetime2(7) NOT NULL CONSTRAINT DF_Categories_CreatedOn DEFAULT SYSUTCDATETIME();
    ALTER TABLE [dbo].[Categories] ADD [UpdatedOn] datetime2(7) NULL;
    ALTER TABLE [dbo].[Categories] ADD [CreatedBy] uniqueidentifier NULL;
    ALTER TABLE [dbo].[Categories] ADD [UpdatedBy] uniqueidentifier NULL;
    ALTER TABLE [dbo].[Categories] ADD [DeletedOn] datetime2(7) NULL;
    ALTER TABLE [dbo].[Categories] ADD [DisplayOrder] int NOT NULL CONSTRAINT DF_Categories_DisplayOrder DEFAULT 0;
    ALTER TABLE [dbo].[Categories] ADD [Description] nvarchar(500) NULL;
    ALTER TABLE [dbo].[Categories] ADD [RowVersion] rowversion NOT NULL;
END
GO

-- Screenshots: Ensure audit columns & RowVersion exist
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Screenshots]') AND name = N'CreatedOn')
BEGIN
    ALTER TABLE [dbo].[Screenshots] ADD [CreatedOn] datetime2(7) NOT NULL CONSTRAINT DF_Screenshots_CreatedOn DEFAULT SYSUTCDATETIME();
    ALTER TABLE [dbo].[Screenshots] ADD [UpdatedOn] datetime2(7) NULL;
    ALTER TABLE [dbo].[Screenshots] ADD [CreatedBy] uniqueidentifier NULL;
    ALTER TABLE [dbo].[Screenshots] ADD [UpdatedBy] uniqueidentifier NULL;
    ALTER TABLE [dbo].[Screenshots] ADD [DeletedOn] datetime2(7) NULL;
    ALTER TABLE [dbo].[Screenshots] ADD [RowVersion] rowversion NOT NULL;
END
GO

-- Screenshots: Ensure Sprint 1.3 AI classification columns exist
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Screenshots]') AND name = N'ClassificationConfidence')
BEGIN
    ALTER TABLE [dbo].[Screenshots] ADD [ClassificationConfidence] float NULL;
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Screenshots]') AND name = N'DetectedApp')
BEGIN
    ALTER TABLE [dbo].[Screenshots] ADD [DetectedApp] nvarchar(100) NULL;
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Screenshots]') AND name = N'KeywordsJson')
BEGIN
    ALTER TABLE [dbo].[Screenshots] ADD [KeywordsJson] nvarchar(max) NULL CONSTRAINT DF_Screenshots_KeywordsJson DEFAULT N'[]';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Screenshots]') AND name = N'IsAutoCategorized')
BEGIN
    ALTER TABLE [dbo].[Screenshots] ADD [IsAutoCategorized] bit NOT NULL CONSTRAINT DF_Screenshots_IsAutoCategorized DEFAULT 0;
END
GO

-- Tags: Ensure audit columns & RowVersion exist
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Tags]') AND name = N'CreatedOn')
BEGIN
    ALTER TABLE [dbo].[Tags] ADD [CreatedOn] datetime2(7) NOT NULL CONSTRAINT DF_Tags_CreatedOn DEFAULT SYSUTCDATETIME();
    ALTER TABLE [dbo].[Tags] ADD [UpdatedOn] datetime2(7) NULL;
    ALTER TABLE [dbo].[Tags] ADD [CreatedBy] uniqueidentifier NULL;
    ALTER TABLE [dbo].[Tags] ADD [UpdatedBy] uniqueidentifier NULL;
    ALTER TABLE [dbo].[Tags] ADD [DeletedOn] datetime2(7) NULL;
    ALTER TABLE [dbo].[Tags] ADD [RowVersion] rowversion NOT NULL;
END
GO

-- OCRCache: Ensure audit columns & RowVersion exist
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[OCRCache]') AND name = N'CreatedOn')
BEGIN
    ALTER TABLE [dbo].[OCRCache] ADD [CreatedOn] datetime2(7) NOT NULL CONSTRAINT DF_OCRCache_CreatedOn DEFAULT SYSUTCDATETIME();
    ALTER TABLE [dbo].[OCRCache] ADD [UpdatedOn] datetime2(7) NULL;
    ALTER TABLE [dbo].[OCRCache] ADD [CreatedBy] uniqueidentifier NULL;
    ALTER TABLE [dbo].[OCRCache] ADD [UpdatedBy] uniqueidentifier NULL;
    ALTER TABLE [dbo].[OCRCache] ADD [DeletedOn] datetime2(7) NULL;
    ALTER TABLE [dbo].[OCRCache] ADD [RowVersion] rowversion NOT NULL;
END
GO

-- ClassificationHistory: Ensure audit columns & RowVersion exist
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[ClassificationHistory]') AND name = N'CreatedOn')
BEGIN
    ALTER TABLE [dbo].[ClassificationHistory] ADD [CreatedOn] datetime2(7) NOT NULL CONSTRAINT DF_ClassificationHistory_CreatedOn DEFAULT SYSUTCDATETIME();
    ALTER TABLE [dbo].[ClassificationHistory] ADD [UpdatedOn] datetime2(7) NULL;
    ALTER TABLE [dbo].[ClassificationHistory] ADD [CreatedBy] uniqueidentifier NULL;
    ALTER TABLE [dbo].[ClassificationHistory] ADD [UpdatedBy] uniqueidentifier NULL;
    ALTER TABLE [dbo].[ClassificationHistory] ADD [DeletedOn] datetime2(7) NULL;
    ALTER TABLE [dbo].[ClassificationHistory] ADD [RowVersion] rowversion NOT NULL;
END
GO

-- RefreshTokens: Ensure audit columns & RowVersion exist
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[RefreshTokens]') AND name = N'CreatedOn')
BEGIN
    ALTER TABLE [dbo].[RefreshTokens] ADD [CreatedOn] datetime2(7) NOT NULL CONSTRAINT DF_RefreshTokens_CreatedOn DEFAULT SYSUTCDATETIME();
    ALTER TABLE [dbo].[RefreshTokens] ADD [UpdatedOn] datetime2(7) NULL;
    ALTER TABLE [dbo].[RefreshTokens] ADD [CreatedBy] uniqueidentifier NULL;
    ALTER TABLE [dbo].[RefreshTokens] ADD [UpdatedBy] uniqueidentifier NULL;
    ALTER TABLE [dbo].[RefreshTokens] ADD [DeletedOn] datetime2(7) NULL;
    ALTER TABLE [dbo].[RefreshTokens] ADD [RowVersion] rowversion NOT NULL;
END
GO

-- ============================================================================
-- 3. CREATE NEW AI TABLES
-- ============================================================================

-- Table: AIModels (Cognitive models registry)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[AIModels]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[AIModels] (
        [Id] uniqueidentifier NOT NULL CONSTRAINT DF_AIModels_Id DEFAULT NEWSEQUENTIALID(),
        [ModelCode] nvarchar(100) NOT NULL,
        [DisplayName] nvarchar(100) NOT NULL,
        [Provider] nvarchar(100) NOT NULL,
        [Version] nvarchar(50) NOT NULL CONSTRAINT DF_AIModels_Version DEFAULT '1.0',
        [MaxContextTokens] int NOT NULL CONSTRAINT DF_AIModels_MaxContextTokens DEFAULT 8192,
        [IsActive] bit NOT NULL CONSTRAINT DF_AIModels_IsActive DEFAULT 1,
        [CapabilitiesJson] nvarchar(max) NULL,
        [CreatedOn] datetime2(7) NOT NULL CONSTRAINT DF_AIModels_CreatedOn DEFAULT SYSUTCDATETIME(),
        [UpdatedOn] datetime2(7) NULL,
        [CreatedBy] uniqueidentifier NULL,
        [UpdatedBy] uniqueidentifier NULL,
        [IsDeleted] bit NOT NULL CONSTRAINT DF_AIModels_IsDeleted DEFAULT 0,
        [DeletedOn] datetime2(7) NULL,
        [RowVersion] rowversion NOT NULL,
        CONSTRAINT PK_AIModels PRIMARY KEY CLUSTERED ([Id]),
        CONSTRAINT UQ_AIModels_ModelCode UNIQUE NONCLUSTERED ([ModelCode])
    );
END
GO

-- Table: DeviceInfo (Mobile / Desktop client sync devices)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DeviceInfo]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[DeviceInfo] (
        [Id] uniqueidentifier NOT NULL CONSTRAINT DF_DeviceInfo_Id DEFAULT NEWSEQUENTIALID(),
        [UserId] uniqueidentifier NOT NULL,
        [DeviceIdentifier] nvarchar(256) NOT NULL,
        [DeviceName] nvarchar(100) NOT NULL,
        [Platform] nvarchar(50) NOT NULL,
        [OSVersion] nvarchar(50) NULL,
        [AppVersion] nvarchar(50) NULL,
        [LastSyncAt] datetime2(7) NULL,
        [IsActive] bit NOT NULL CONSTRAINT DF_DeviceInfo_IsActive DEFAULT 1,
        [CreatedOn] datetime2(7) NOT NULL CONSTRAINT DF_DeviceInfo_CreatedOn DEFAULT SYSUTCDATETIME(),
        [UpdatedOn] datetime2(7) NULL,
        [CreatedBy] uniqueidentifier NULL,
        [UpdatedBy] uniqueidentifier NULL,
        [IsDeleted] bit NOT NULL CONSTRAINT DF_DeviceInfo_IsDeleted DEFAULT 0,
        [DeletedOn] datetime2(7) NULL,
        [RowVersion] rowversion NOT NULL,
        CONSTRAINT PK_DeviceInfo PRIMARY KEY CLUSTERED ([Id]),
        CONSTRAINT FK_DeviceInfo_Users FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE CASCADE,
        CONSTRAINT UQ_DeviceInfo_User_Device UNIQUE NONCLUSTERED ([UserId], [DeviceIdentifier])
    );
END
GO

-- Table: AppSettings (Configuration preferences)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[AppSettings]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[AppSettings] (
        [Id] uniqueidentifier NOT NULL CONSTRAINT DF_AppSettings_Id DEFAULT NEWSEQUENTIALID(),
        [UserId] uniqueidentifier NULL,
        [SettingKey] nvarchar(100) NOT NULL,
        [SettingValue] nvarchar(max) NOT NULL,
        [DataType] nvarchar(50) NOT NULL CONSTRAINT DF_AppSettings_DataType DEFAULT 'String',
        [Description] nvarchar(500) NULL,
        [CreatedOn] datetime2(7) NOT NULL CONSTRAINT DF_AppSettings_CreatedOn DEFAULT SYSUTCDATETIME(),
        [UpdatedOn] datetime2(7) NULL,
        [CreatedBy] uniqueidentifier NULL,
        [UpdatedBy] uniqueidentifier NULL,
        [IsDeleted] bit NOT NULL CONSTRAINT DF_AppSettings_IsDeleted DEFAULT 0,
        [DeletedOn] datetime2(7) NULL,
        [RowVersion] rowversion NOT NULL,
        CONSTRAINT PK_AppSettings PRIMARY KEY CLUSTERED ([Id]),
        CONSTRAINT FK_AppSettings_Users FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE CASCADE,
        CONSTRAINT CK_AppSettings_DataType CHECK ([DataType] IN ('String', 'Boolean', 'Integer', 'Decimal', 'Json'))
    );
    CREATE UNIQUE NONCLUSTERED INDEX UQ_AppSettings_Global ON [dbo].[AppSettings]([SettingKey]) WHERE [UserId] IS NULL AND [IsDeleted] = 0;
    CREATE UNIQUE NONCLUSTERED INDEX UQ_AppSettings_User ON [dbo].[AppSettings]([UserId], [SettingKey]) WHERE [UserId] IS NOT NULL AND [IsDeleted] = 0;
END
GO

-- Table: FolderContext (AI Knowledge digest for Smart Folders)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[FolderContext]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[FolderContext] (
        [Id] uniqueidentifier NOT NULL CONSTRAINT DF_FolderContext_Id DEFAULT NEWSEQUENTIALID(),
        [CategoryId] uniqueidentifier NOT NULL,
        [UserId] uniqueidentifier NOT NULL,
        [Summary] nvarchar(max) NOT NULL,
        [KeyTopicsJson] nvarchar(max) NOT NULL CONSTRAINT DF_FolderContext_KeyTopicsJson DEFAULT '[]',
        [ScreenshotCount] int NOT NULL CONSTRAINT DF_FolderContext_ScreenshotCount DEFAULT 0,
        [LastGeneratedAt] datetime2(7) NOT NULL CONSTRAINT DF_FolderContext_LastGeneratedAt DEFAULT SYSUTCDATETIME(),
        [AIModelId] uniqueidentifier NULL,
        [CreatedOn] datetime2(7) NOT NULL CONSTRAINT DF_FolderContext_CreatedOn DEFAULT SYSUTCDATETIME(),
        [UpdatedOn] datetime2(7) NULL,
        [CreatedBy] uniqueidentifier NULL,
        [UpdatedBy] uniqueidentifier NULL,
        [IsDeleted] bit NOT NULL CONSTRAINT DF_FolderContext_IsDeleted DEFAULT 0,
        [DeletedOn] datetime2(7) NULL,
        [RowVersion] rowversion NOT NULL,
        CONSTRAINT PK_FolderContext PRIMARY KEY CLUSTERED ([Id]),
        CONSTRAINT FK_FolderContext_Categories FOREIGN KEY ([CategoryId]) REFERENCES [dbo].[Categories]([Id]) ON DELETE NO ACTION,
        CONSTRAINT FK_FolderContext_Users FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE NO ACTION,
        CONSTRAINT FK_FolderContext_AIModels FOREIGN KEY ([AIModelId]) REFERENCES [dbo].[AIModels]([Id]) ON DELETE SET NULL
    );
    CREATE UNIQUE NONCLUSTERED INDEX UQ_FolderContext_Category_User ON [dbo].[FolderContext]([CategoryId], [UserId]) WHERE [IsDeleted] = 0;
END
GO

-- Table: Entities (Extracted named entities from screenshots)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Entities]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[Entities] (
        [Id] uniqueidentifier NOT NULL CONSTRAINT DF_Entities_Id DEFAULT NEWSEQUENTIALID(),
        [ScreenshotId] uniqueidentifier NOT NULL,
        [UserId] uniqueidentifier NOT NULL,
        [EntityType] nvarchar(50) NOT NULL,
        [EntityValue] nvarchar(500) NOT NULL,
        [Confidence] float NOT NULL CONSTRAINT DF_Entities_Confidence DEFAULT 1.0,
        [MetadataJson] nvarchar(max) NULL,
        [CreatedOn] datetime2(7) NOT NULL CONSTRAINT DF_Entities_CreatedOn DEFAULT SYSUTCDATETIME(),
        [UpdatedOn] datetime2(7) NULL,
        [CreatedBy] uniqueidentifier NULL,
        [UpdatedBy] uniqueidentifier NULL,
        [IsDeleted] bit NOT NULL CONSTRAINT DF_Entities_IsDeleted DEFAULT 0,
        [DeletedOn] datetime2(7) NULL,
        [RowVersion] rowversion NOT NULL,
        CONSTRAINT PK_Entities PRIMARY KEY CLUSTERED ([Id]),
        CONSTRAINT FK_Entities_Screenshots FOREIGN KEY ([ScreenshotId]) REFERENCES [dbo].[Screenshots]([Id]) ON DELETE CASCADE,
        CONSTRAINT FK_Entities_Users FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE NO ACTION
    );
    CREATE NONCLUSTERED INDEX IX_Entities_Screenshot_Type ON [dbo].[Entities]([ScreenshotId], [EntityType]) WHERE [IsDeleted] = 0;
    CREATE NONCLUSTERED INDEX IX_Entities_User_Value ON [dbo].[Entities]([UserId], [EntityType], [EntityValue]) WHERE [IsDeleted] = 0;
END
GO

-- Table: Tasks (Actionable tasks & reminders detected in screenshots)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Tasks]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[Tasks] (
        [Id] uniqueidentifier NOT NULL CONSTRAINT DF_Tasks_Id DEFAULT NEWSEQUENTIALID(),
        [ScreenshotId] uniqueidentifier NULL,
        [CategoryId] uniqueidentifier NULL,
        [UserId] uniqueidentifier NOT NULL,
        [Title] nvarchar(255) NOT NULL,
        [Description] nvarchar(max) NULL,
        [DueDate] datetime2(7) NULL,
        [Priority] nvarchar(20) NOT NULL CONSTRAINT DF_Tasks_Priority DEFAULT 'Medium',
        [Status] nvarchar(20) NOT NULL CONSTRAINT DF_Tasks_Status DEFAULT 'Pending',
        [IsCompleted] bit NOT NULL CONSTRAINT DF_Tasks_IsCompleted DEFAULT 0,
        [CompletedAt] datetime2(7) NULL,
        [CreatedOn] datetime2(7) NOT NULL CONSTRAINT DF_Tasks_CreatedOn DEFAULT SYSUTCDATETIME(),
        [UpdatedOn] datetime2(7) NULL,
        [CreatedBy] uniqueidentifier NULL,
        [UpdatedBy] uniqueidentifier NULL,
        [IsDeleted] bit NOT NULL CONSTRAINT DF_Tasks_IsDeleted DEFAULT 0,
        [DeletedOn] datetime2(7) NULL,
        [RowVersion] rowversion NOT NULL,
        CONSTRAINT PK_Tasks PRIMARY KEY CLUSTERED ([Id]),
        CONSTRAINT FK_Tasks_Screenshots FOREIGN KEY ([ScreenshotId]) REFERENCES [dbo].[Screenshots]([Id]) ON DELETE SET NULL,
        CONSTRAINT FK_Tasks_Categories FOREIGN KEY ([CategoryId]) REFERENCES [dbo].[Categories]([Id]) ON DELETE NO ACTION,
        CONSTRAINT FK_Tasks_Users FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE NO ACTION,
        CONSTRAINT CK_Tasks_Priority CHECK ([Priority] IN ('Low', 'Medium', 'High', 'Urgent')),
        CONSTRAINT CK_Tasks_Status CHECK ([Status] IN ('Pending', 'InProgress', 'Completed', 'Dismissed'))
    );
    CREATE NONCLUSTERED INDEX IX_Tasks_User_Status_Due ON [dbo].[Tasks]([UserId], [Status], [DueDate]) WHERE [IsDeleted] = 0;
    CREATE NONCLUSTERED INDEX IX_Tasks_User_Completed ON [dbo].[Tasks]([UserId], [IsCompleted]) WHERE [IsDeleted] = 0;
END
GO

-- Table: ChatHistory (Multi-turn conversations with screenshots and smart folders)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ChatHistory]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[ChatHistory] (
        [Id] uniqueidentifier NOT NULL CONSTRAINT DF_ChatHistory_Id DEFAULT NEWSEQUENTIALID(),
        [SessionId] uniqueidentifier NOT NULL,
        [UserId] uniqueidentifier NOT NULL,
        [CategoryId] uniqueidentifier NULL,
        [ScreenshotId] uniqueidentifier NULL,
        [Role] nvarchar(20) NOT NULL,
        [Message] nvarchar(max) NOT NULL,
        [ReferencedScreenshotIdsJson] nvarchar(max) NULL,
        [PromptTokens] int NULL,
        [CompletionTokens] int NULL,
        [AIModelId] uniqueidentifier NULL,
        [CreatedOn] datetime2(7) NOT NULL CONSTRAINT DF_ChatHistory_CreatedOn DEFAULT SYSUTCDATETIME(),
        [UpdatedOn] datetime2(7) NULL,
        [CreatedBy] uniqueidentifier NULL,
        [UpdatedBy] uniqueidentifier NULL,
        [IsDeleted] bit NOT NULL CONSTRAINT DF_ChatHistory_IsDeleted DEFAULT 0,
        [DeletedOn] datetime2(7) NULL,
        [RowVersion] rowversion NOT NULL,
        CONSTRAINT PK_ChatHistory PRIMARY KEY CLUSTERED ([Id]),
        CONSTRAINT FK_ChatHistory_Users FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE NO ACTION,
        CONSTRAINT FK_ChatHistory_Categories FOREIGN KEY ([CategoryId]) REFERENCES [dbo].[Categories]([Id]) ON DELETE NO ACTION,
        CONSTRAINT FK_ChatHistory_Screenshots FOREIGN KEY ([ScreenshotId]) REFERENCES [dbo].[Screenshots]([Id]) ON DELETE NO ACTION,
        CONSTRAINT FK_ChatHistory_AIModels FOREIGN KEY ([AIModelId]) REFERENCES [dbo].[AIModels]([Id]) ON DELETE SET NULL,
        CONSTRAINT CK_ChatHistory_Role CHECK ([Role] IN ('User', 'Assistant', 'System'))
    );
    CREATE NONCLUSTERED INDEX IX_ChatHistory_User_Session_Created ON [dbo].[ChatHistory]([UserId], [SessionId], [CreatedOn]) WHERE [IsDeleted] = 0;
END
GO

-- Table: SearchHistory (Query analytics and telemetry)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[SearchHistory]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[SearchHistory] (
        [Id] uniqueidentifier NOT NULL CONSTRAINT DF_SearchHistory_Id DEFAULT NEWSEQUENTIALID(),
        [UserId] uniqueidentifier NOT NULL,
        [Query] nvarchar(500) NOT NULL,
        [FilterJson] nvarchar(max) NULL,
        [ResultsCount] int NOT NULL CONSTRAINT DF_SearchHistory_ResultsCount DEFAULT 0,
        [ExecutionTimeMs] int NOT NULL CONSTRAINT DF_SearchHistory_ExecutionTimeMs DEFAULT 0,
        [ClickedScreenshotId] uniqueidentifier NULL,
        [CreatedOn] datetime2(7) NOT NULL CONSTRAINT DF_SearchHistory_CreatedOn DEFAULT SYSUTCDATETIME(),
        [UpdatedOn] datetime2(7) NULL,
        [CreatedBy] uniqueidentifier NULL,
        [UpdatedBy] uniqueidentifier NULL,
        [IsDeleted] bit NOT NULL CONSTRAINT DF_SearchHistory_IsDeleted DEFAULT 0,
        [DeletedOn] datetime2(7) NULL,
        [RowVersion] rowversion NOT NULL,
        CONSTRAINT PK_SearchHistory PRIMARY KEY CLUSTERED ([Id]),
        CONSTRAINT FK_SearchHistory_Users FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE NO ACTION,
        CONSTRAINT FK_SearchHistory_Screenshots FOREIGN KEY ([ClickedScreenshotId]) REFERENCES [dbo].[Screenshots]([Id]) ON DELETE SET NULL
    );
    CREATE NONCLUSTERED INDEX IX_SearchHistory_User_Created ON [dbo].[SearchHistory]([UserId], [CreatedOn] DESC) WHERE [IsDeleted] = 0;
END
GO

-- ============================================================================
-- 4. CREATE FUTURE ARCHITECTURE TABLES (STRUCTURE READY)
-- ============================================================================

-- Table: Collections (Custom user curated screenshot albums)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Collections]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[Collections] (
        [Id] uniqueidentifier NOT NULL CONSTRAINT DF_Collections_Id DEFAULT NEWSEQUENTIALID(),
        [UserId] uniqueidentifier NOT NULL,
        [Title] nvarchar(150) NOT NULL,
        [Description] nvarchar(500) NULL,
        [CoverScreenshotId] uniqueidentifier NULL,
        [IsPublic] bit NOT NULL CONSTRAINT DF_Collections_IsPublic DEFAULT 0,
        [CreatedOn] datetime2(7) NOT NULL CONSTRAINT DF_Collections_CreatedOn DEFAULT SYSUTCDATETIME(),
        [UpdatedOn] datetime2(7) NULL,
        [CreatedBy] uniqueidentifier NULL,
        [UpdatedBy] uniqueidentifier NULL,
        [IsDeleted] bit NOT NULL CONSTRAINT DF_Collections_IsDeleted DEFAULT 0,
        [DeletedOn] datetime2(7) NULL,
        [RowVersion] rowversion NOT NULL,
        CONSTRAINT PK_Collections PRIMARY KEY CLUSTERED ([Id]),
        CONSTRAINT FK_Collections_Users FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE NO ACTION,
        CONSTRAINT FK_Collections_Cover FOREIGN KEY ([CoverScreenshotId]) REFERENCES [dbo].[Screenshots]([Id]) ON DELETE SET NULL
    );
END
GO

-- Table: CollectionScreenshots (Many-to-many join)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CollectionScreenshots]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[CollectionScreenshots] (
        [CollectionId] uniqueidentifier NOT NULL,
        [ScreenshotId] uniqueidentifier NOT NULL,
        [OrderIndex] int NOT NULL CONSTRAINT DF_CollectionScreenshots_OrderIndex DEFAULT 0,
        [AddedAt] datetime2(7) NOT NULL CONSTRAINT DF_CollectionScreenshots_AddedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_CollectionScreenshots PRIMARY KEY CLUSTERED ([CollectionId], [ScreenshotId]),
        CONSTRAINT FK_CollectionScreenshots_Collections FOREIGN KEY ([CollectionId]) REFERENCES [dbo].[Collections]([Id]) ON DELETE CASCADE,
        CONSTRAINT FK_CollectionScreenshots_Screenshots FOREIGN KEY ([ScreenshotId]) REFERENCES [dbo].[Screenshots]([Id]) ON DELETE CASCADE
    );
END
GO

-- Table: EmbeddingCache (Vector embeddings for Semantic RAG)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[EmbeddingCache]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[EmbeddingCache] (
        [Id] uniqueidentifier NOT NULL CONSTRAINT DF_EmbeddingCache_Id DEFAULT NEWSEQUENTIALID(),
        [ScreenshotId] uniqueidentifier NOT NULL,
        [EmbeddingModel] nvarchar(100) NOT NULL,
        [EmbeddingVector] varbinary(max) NOT NULL,
        [Dimensions] int NOT NULL,
        [Checksum] nvarchar(128) NOT NULL,
        [CreatedOn] datetime2(7) NOT NULL CONSTRAINT DF_EmbeddingCache_CreatedOn DEFAULT SYSUTCDATETIME(),
        [UpdatedOn] datetime2(7) NULL,
        [CreatedBy] uniqueidentifier NULL,
        [UpdatedBy] uniqueidentifier NULL,
        [IsDeleted] bit NOT NULL CONSTRAINT DF_EmbeddingCache_IsDeleted DEFAULT 0,
        [DeletedOn] datetime2(7) NULL,
        [RowVersion] rowversion NOT NULL,
        CONSTRAINT PK_EmbeddingCache PRIMARY KEY CLUSTERED ([Id]),
        CONSTRAINT FK_EmbeddingCache_Screenshots FOREIGN KEY ([ScreenshotId]) REFERENCES [dbo].[Screenshots]([Id]) ON DELETE CASCADE,
        CONSTRAINT UQ_EmbeddingCache_Screenshot_Model UNIQUE NONCLUSTERED ([ScreenshotId], [EmbeddingModel])
    );
END
GO

-- Table: NotificationHistory (Push & background sync notification alerts)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[NotificationHistory]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[NotificationHistory] (
        [Id] uniqueidentifier NOT NULL CONSTRAINT DF_NotificationHistory_Id DEFAULT NEWSEQUENTIALID(),
        [UserId] uniqueidentifier NOT NULL,
        [Title] nvarchar(200) NOT NULL,
        [Message] nvarchar(1000) NOT NULL,
        [Type] nvarchar(50) NOT NULL,
        [PayloadJson] nvarchar(max) NULL,
        [IsRead] bit NOT NULL CONSTRAINT DF_NotificationHistory_IsRead DEFAULT 0,
        [ReadAt] datetime2(7) NULL,
        [CreatedOn] datetime2(7) NOT NULL CONSTRAINT DF_NotificationHistory_CreatedOn DEFAULT SYSUTCDATETIME(),
        [UpdatedOn] datetime2(7) NULL,
        [CreatedBy] uniqueidentifier NULL,
        [UpdatedBy] uniqueidentifier NULL,
        [IsDeleted] bit NOT NULL CONSTRAINT DF_NotificationHistory_IsDeleted DEFAULT 0,
        [DeletedOn] datetime2(7) NULL,
        [RowVersion] rowversion NOT NULL,
        CONSTRAINT PK_NotificationHistory PRIMARY KEY CLUSTERED ([Id]),
        CONSTRAINT FK_NotificationHistory_Users FOREIGN KEY ([UserId]) REFERENCES [dbo].[Users]([Id]) ON DELETE CASCADE
    );
    CREATE NONCLUSTERED INDEX IX_NotificationHistory_User_Unread ON [dbo].[NotificationHistory]([UserId], [IsRead]) WHERE [IsDeleted] = 0;
END
GO
