-- ============================================================================
-- ContextVault Database Architecture v1.0
-- Script 03: Production Stored Procedures (T-SQL)
-- Target DBMS: Microsoft SQL Server 2022+ / Azure SQL / LocalDB
-- ============================================================================

USE [AIScreenshotOrganizerDb];
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- 1. USP_ScanScreenshot (Idempotent single screenshot scan / upsert)
CREATE OR ALTER PROCEDURE [dbo].[USP_ScanScreenshot]
    @UserId uniqueidentifier,
    @DeviceAssetId nvarchar(256),
    @ImageId nvarchar(256),
    @ImagePath nvarchar(1000),
    @ThumbnailPath nvarchar(1000) = NULL,
    @FileName nvarchar(260),
    @FileSize bigint = 0,
    @ContentUri nvarchar(1000) = NULL,
    @CapturedDate datetime2(7),
    @SourceApp nvarchar(100) = N'',
    @Width int = 0,
    @Height int = 0,
    @OCRText nvarchar(max) = N'',
    @VisionDescription nvarchar(max) = NULL,
    @OCRStatus nvarchar(30) = N'none',
    @CategoryId uniqueidentifier = NULL,
    @SubCategoryId uniqueidentifier = NULL,
    @Confidence float = 0.0,
    @Hash nvarchar(128) = N'',
    @IsMock bit = 0
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @ScreenshotId uniqueidentifier;

    -- Check if record already exists for this user and device asset
    SELECT TOP 1 @ScreenshotId = [Id]
    FROM [dbo].[Screenshots]
    WHERE [UserId] = @UserId 
      AND [DeviceAssetId] = @DeviceAssetId
      AND [IsDeleted] = 0;

    IF @ScreenshotId IS NOT NULL
    BEGIN
        -- UPDATE existing screenshot metadata
        UPDATE [dbo].[Screenshots]
        SET [ImageId] = @ImageId,
            [ImagePath] = @ImagePath,
            [ThumbnailPath] = COALESCE(@ThumbnailPath, [ThumbnailPath]),
            [FileName] = @FileName,
            [FileSize] = @FileSize,
            [ContentUri] = COALESCE(@ContentUri, [ContentUri]),
            [SourceApp] = CASE WHEN @SourceApp <> N'' THEN @SourceApp ELSE [SourceApp] END,
            [Width] = CASE WHEN @Width > 0 THEN @Width ELSE [Width] END,
            [Height] = CASE WHEN @Height > 0 THEN @Height ELSE [Height] END,
            [OCRText] = CASE WHEN @OCRText <> N'' THEN @OCRText ELSE [OCRText] END,
            [VisionDescription] = COALESCE(@VisionDescription, [VisionDescription]),
            [OCRStatus] = CASE WHEN @OCRStatus <> N'none' THEN @OCRStatus ELSE [OCRStatus] END,
            [CategoryId] = COALESCE(@CategoryId, [CategoryId]),
            [SubCategoryId] = COALESCE(@SubCategoryId, [SubCategoryId]),
            [Confidence] = CASE WHEN @Confidence > 0 THEN @Confidence ELSE [Confidence] END,
            [Hash] = CASE WHEN @Hash <> N'' THEN @Hash ELSE [Hash] END,
            [LastScannedAt] = SYSUTCDATETIME(),
            [UpdatedOn] = SYSUTCDATETIME()
        WHERE [Id] = @ScreenshotId;
    END
    ELSE
    BEGIN
        -- INSERT new screenshot metadata
        SET @ScreenshotId = NEWID();

        INSERT INTO [dbo].[Screenshots] (
            [Id], [UserId], [DeviceAssetId], [ImageId], [ImagePath], [ThumbnailPath],
            [FileName], [FileSize], [ContentUri], [CapturedDate], [SourceApp],
            [Width], [Height], [OCRText], [VisionDescription], [OCRStatus],
            [CategoryId], [SubCategoryId], [Confidence], [Hash],
            [IsFavorite], [IsReviewed], [IsSynced], [IsMock], [LastScannedAt],
            [CreatedOn], [IsDeleted]
        ) VALUES (
            @ScreenshotId, @UserId, @DeviceAssetId, @ImageId, @ImagePath, @ThumbnailPath,
            @FileName, @FileSize, @ContentUri, @CapturedDate, @SourceApp,
            @Width, @Height, @OCRText, @VisionDescription, @OCRStatus,
            @CategoryId, @SubCategoryId, @Confidence, @Hash,
            0, 0, 1, @IsMock, SYSUTCDATETIME(),
            SYSUTCDATETIME(), 0
        );

        -- Link primary category in join table if provided
        IF @CategoryId IS NOT NULL
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM [dbo].[ScreenshotCategories] WHERE [ScreenshotId] = @ScreenshotId AND [CategoryId] = @CategoryId)
            BEGIN
                INSERT INTO [dbo].[ScreenshotCategories] ([ScreenshotId], [CategoryId])
                VALUES (@ScreenshotId, @CategoryId);
            END
        END
    END

    -- Return full updated screenshot record
    SELECT 
        s.[Id], s.[UserId], s.[DeviceAssetId], s.[FileName], s.[FileSize],
        s.[CapturedDate], s.[SourceApp], s.[Width], s.[Height], s.[OCRText],
        s.[VisionDescription], s.[OCRStatus], s.[CategoryId], s.[SubCategoryId],
        c.[Name] AS [CategoryName], sc.[Name] AS [SubCategoryName],
        s.[Confidence], s.[IsFavorite], s.[IsReviewed], s.[LastScannedAt], s.[CreatedOn]
    FROM [dbo].[Screenshots] s
    LEFT JOIN [dbo].[Categories] c ON s.[CategoryId] = c.[Id]
    LEFT JOIN [dbo].[Categories] sc ON s.[SubCategoryId] = sc.[Id]
    WHERE s.[Id] = @ScreenshotId;
END;
GO

-- 2. USP_GenerateFolderContext (Aggregates screenshot OCR and metadata for Smart Folders)
CREATE OR ALTER PROCEDURE [dbo].[USP_GenerateFolderContext]
    @CategoryId uniqueidentifier,
    @UserId uniqueidentifier,
    @Summary nvarchar(max),
    @KeyTopicsJson nvarchar(max) = N'[]',
    @AIModelId uniqueidentifier = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Count int = (
        SELECT COUNT(1)
        FROM [dbo].[Screenshots]
        WHERE ([CategoryId] = @CategoryId OR [SubCategoryId] = @CategoryId)
          AND [UserId] = @UserId
          AND [IsDeleted] = 0
    );

    IF EXISTS (SELECT 1 FROM [dbo].[FolderContext] WHERE [CategoryId] = @CategoryId AND [UserId] = @UserId AND [IsDeleted] = 0)
    BEGIN
        UPDATE [dbo].[FolderContext]
        SET [Summary] = @Summary,
            [KeyTopicsJson] = @KeyTopicsJson,
            [ScreenshotCount] = @Count,
            [LastGeneratedAt] = SYSUTCDATETIME(),
            [AIModelId] = @AIModelId,
            [UpdatedOn] = SYSUTCDATETIME()
        WHERE [CategoryId] = @CategoryId AND [UserId] = @UserId AND [IsDeleted] = 0;
    END
    ELSE
    BEGIN
        INSERT INTO [dbo].[FolderContext] (
            [Id], [CategoryId], [UserId], [Summary], [KeyTopicsJson],
            [ScreenshotCount], [LastGeneratedAt], [AIModelId], [CreatedOn], [IsDeleted]
        ) VALUES (
            NEWID(), @CategoryId, @UserId, @Summary, @KeyTopicsJson,
            @Count, SYSUTCDATETIME(), @AIModelId, SYSUTCDATETIME(), 0
        );
    END

    SELECT TOP 1 * 
    FROM [dbo].[FolderContext] 
    WHERE [CategoryId] = @CategoryId AND [UserId] = @UserId AND [IsDeleted] = 0;
END;
GO

-- 3. USP_GetFolderContext (Retrieves Smart Folder synthesis and subcategory metadata)
CREATE OR ALTER PROCEDURE [dbo].[USP_GetFolderContext]
    @CategoryId uniqueidentifier,
    @UserId uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    -- 1. Folder Details & Synthesis
    SELECT 
        c.[Id] AS [CategoryId],
        c.[Name] AS [CategoryName],
        c.[ParentCategoryId],
        c.[Icon],
        c.[Color],
        fc.[Summary],
        fc.[KeyTopicsJson],
        fc.[ScreenshotCount],
        fc.[LastGeneratedAt],
        m.[DisplayName] AS [AIModelName]
    FROM [dbo].[Categories] c
    LEFT JOIN [dbo].[FolderContext] fc ON c.[Id] = fc.[CategoryId] AND fc.[UserId] = @UserId AND fc.[IsDeleted] = 0
    LEFT JOIN [dbo].[AIModels] m ON fc.[AIModelId] = m.[Id]
    WHERE c.[Id] = @CategoryId AND (c.[UserId] = @UserId OR c.[UserId] IS NULL) AND c.[IsDeleted] = 0;

    -- 2. Subcategories
    SELECT 
        sc.[Id] AS [SubCategoryId],
        sc.[Name] AS [SubCategoryName],
        sc.[Icon],
        sc.[DisplayOrder],
        COUNT(s.[Id]) AS [ItemCount]
    FROM [dbo].[Categories] sc
    LEFT JOIN [dbo].[Screenshots] s ON (s.[CategoryId] = sc.[Id] OR s.[SubCategoryId] = sc.[Id]) AND s.[UserId] = @UserId AND s.[IsDeleted] = 0
    WHERE sc.[ParentCategoryId] = @CategoryId AND (sc.[UserId] = @UserId OR sc.[UserId] IS NULL) AND sc.[IsDeleted] = 0
    GROUP BY sc.[Id], sc.[Name], sc.[Icon], sc.[DisplayOrder]
    ORDER BY sc.[DisplayOrder], sc.[Name];
END;
GO

-- 4. USP_SearchScreenshots (Multi-facet text + tag + category search with pagination)
CREATE OR ALTER PROCEDURE [dbo].[USP_SearchScreenshots]
    @UserId uniqueidentifier,
    @Query nvarchar(200) = N'',
    @CategoryId uniqueidentifier = NULL,
    @TagId uniqueidentifier = NULL,
    @StartDate datetime2(7) = NULL,
    @EndDate datetime2(7) = NULL,
    @IsFavorite bit = NULL,
    @PageNumber int = 1,
    @PageSize int = 30
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Offset int = (@PageNumber - 1) * @PageSize;
    DECLARE @CleanQuery nvarchar(200) = LTRIM(RTRIM(@Query));

    -- Total count query
    SELECT COUNT(DISTINCT s.[Id]) AS [TotalCount]
    FROM [dbo].[Screenshots] s
    LEFT JOIN [dbo].[ScreenshotTags] st ON s.[Id] = st.[ScreenshotId]
    WHERE s.[UserId] = @UserId
      AND s.[IsDeleted] = 0
      AND (@CategoryId IS NULL OR s.[CategoryId] = @CategoryId OR s.[SubCategoryId] = @CategoryId)
      AND (@TagId IS NULL OR st.[TagId] = @TagId)
      AND (@IsFavorite IS NULL OR s.[IsFavorite] = @IsFavorite)
      AND (@StartDate IS NULL OR s.[CapturedDate] >= @StartDate)
      AND (@EndDate IS NULL OR s.[CapturedDate] <= @EndDate)
      AND (
          @CleanQuery = N''
          OR s.[FileName] LIKE N'%' + @CleanQuery + N'%'
          OR s.[OCRText] LIKE N'%' + @CleanQuery + N'%'
          OR s.[SourceApp] LIKE N'%' + @CleanQuery + N'%'
          OR s.[VisionDescription] LIKE N'%' + @CleanQuery + N'%'
      );

    -- Paged results
    SELECT DISTINCT
        s.[Id],
        s.[UserId],
        s.[DeviceAssetId],
        s.[FileName],
        s.[FileSize],
        s.[ImagePath],
        s.[ThumbnailPath],
        s.[CapturedDate],
        s.[SourceApp],
        s.[Width],
        s.[Height],
        s.[OCRText],
        s.[VisionDescription],
        s.[OCRStatus],
        s.[CategoryId],
        c.[Name] AS [CategoryName],
        s.[SubCategoryId],
        sc.[Name] AS [SubCategoryName],
        s.[Confidence],
        s.[IsFavorite],
        s.[IsReviewed],
        s.[CreatedOn]
    FROM [dbo].[Screenshots] s
    LEFT JOIN [dbo].[Categories] c ON s.[CategoryId] = c.[Id]
    LEFT JOIN [dbo].[Categories] sc ON s.[SubCategoryId] = sc.[Id]
    LEFT JOIN [dbo].[ScreenshotTags] st ON s.[Id] = st.[ScreenshotId]
    WHERE s.[UserId] = @UserId
      AND s.[IsDeleted] = 0
      AND (@CategoryId IS NULL OR s.[CategoryId] = @CategoryId OR s.[SubCategoryId] = @CategoryId)
      AND (@TagId IS NULL OR st.[TagId] = @TagId)
      AND (@IsFavorite IS NULL OR s.[IsFavorite] = @IsFavorite)
      AND (@StartDate IS NULL OR s.[CapturedDate] >= @StartDate)
      AND (@EndDate IS NULL OR s.[CapturedDate] <= @EndDate)
      AND (
          @CleanQuery = N''
          OR s.[FileName] LIKE N'%' + @CleanQuery + N'%'
          OR s.[OCRText] LIKE N'%' + @CleanQuery + N'%'
          OR s.[SourceApp] LIKE N'%' + @CleanQuery + N'%'
          OR s.[VisionDescription] LIKE N'%' + @CleanQuery + N'%'
      )
    ORDER BY s.[CapturedDate] DESC
    OFFSET @Offset ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END;
GO

-- 5. USP_SaveChatHistory (Records user or assistant conversation turns with citations)
CREATE OR ALTER PROCEDURE [dbo].[USP_SaveChatHistory]
    @SessionId uniqueidentifier,
    @UserId uniqueidentifier,
    @CategoryId uniqueidentifier = NULL,
    @ScreenshotId uniqueidentifier = NULL,
    @Role nvarchar(20),
    @Message nvarchar(max),
    @ReferencedScreenshotIdsJson nvarchar(max) = NULL,
    @PromptTokens int = NULL,
    @CompletionTokens int = NULL,
    @AIModelId uniqueidentifier = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @ChatId uniqueidentifier = NEWID();

    INSERT INTO [dbo].[ChatHistory] (
        [Id], [SessionId], [UserId], [CategoryId], [ScreenshotId],
        [Role], [Message], [ReferencedScreenshotIdsJson],
        [PromptTokens], [CompletionTokens], [AIModelId],
        [CreatedOn], [IsDeleted]
    ) VALUES (
        @ChatId, @SessionId, @UserId, @CategoryId, @ScreenshotId,
        @Role, @Message, @ReferencedScreenshotIdsJson,
        @PromptTokens, @CompletionTokens, @AIModelId,
        SYSUTCDATETIME(), 0
    );

    SELECT 
        c.[Id], c.[SessionId], c.[UserId], c.[CategoryId], c.[ScreenshotId],
        c.[Role], c.[Message], c.[ReferencedScreenshotIdsJson],
        c.[PromptTokens], c.[CompletionTokens], c.[CreatedOn],
        m.[DisplayName] AS [AIModelName]
    FROM [dbo].[ChatHistory] c
    LEFT JOIN [dbo].[AIModels] m ON c.[AIModelId] = m.[Id]
    WHERE c.[Id] = @ChatId;
END;
GO

-- 6. USP_GetFolderTimeline (Chronological timeline of screenshots in a Smart Folder)
CREATE OR ALTER PROCEDURE [dbo].[USP_GetFolderTimeline]
    @CategoryId uniqueidentifier,
    @UserId uniqueidentifier,
    @PageNumber int = 1,
    @PageSize int = 50
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Offset int = (@PageNumber - 1) * @PageSize;

    SELECT 
        s.[Id],
        s.[FileName],
        s.[DeviceAssetId],
        s.[ImagePath],
        s.[ThumbnailPath],
        s.[CapturedDate],
        s.[SourceApp],
        SUBSTRING(s.[OCRText], 1, 300) AS [OCRPreview],
        s.[VisionDescription],
        s.[Confidence],
        s.[IsFavorite],
        c.[Name] AS [CategoryName],
        sc.[Name] AS [SubCategoryName]
    FROM [dbo].[Screenshots] s
    LEFT JOIN [dbo].[Categories] c ON s.[CategoryId] = c.[Id]
    LEFT JOIN [dbo].[Categories] sc ON s.[SubCategoryId] = sc.[Id]
    WHERE ([s].[CategoryId] = @CategoryId OR [s].[SubCategoryId] = @CategoryId)
      AND s.[UserId] = @UserId
      AND s.[IsDeleted] = 0
    ORDER BY s.[CapturedDate] DESC
    OFFSET @Offset ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END;
GO

-- 7. USP_UpdateScreenshotCategory (Updates folder assignment and appends audit log)
CREATE OR ALTER PROCEDURE [dbo].[USP_UpdateScreenshotCategory]
    @ScreenshotId uniqueidentifier,
    @UserId uniqueidentifier,
    @NewCategoryId uniqueidentifier,
    @NewSubCategoryId uniqueidentifier = NULL,
    @UpdatedByAI bit = 0,
    @ModelName nvarchar(100) = N'UserManual'
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;

    -- Update screenshot
    UPDATE [dbo].[Screenshots]
    SET [CategoryId] = @NewCategoryId,
        [SubCategoryId] = @NewSubCategoryId,
        [IsReviewed] = 1,
        [UpdatedOn] = SYSUTCDATETIME()
    WHERE [Id] = @ScreenshotId AND [UserId] = @UserId AND [IsDeleted] = 0;

    -- Sync join table
    IF NOT EXISTS (SELECT 1 FROM [dbo].[ScreenshotCategories] WHERE [ScreenshotId] = @ScreenshotId AND [CategoryId] = @NewCategoryId)
    BEGIN
        INSERT INTO [dbo].[ScreenshotCategories] ([ScreenshotId], [CategoryId])
        VALUES (@ScreenshotId, @NewCategoryId);
    END

    -- Get category name for audit history
    DECLARE @CatName nvarchar(100) = (SELECT [Name] FROM [dbo].[Categories] WHERE [Id] = @NewCategoryId);
    DECLARE @SubCatName nvarchar(100) = (SELECT [Name] FROM [dbo].[Categories] WHERE [Id] = @NewSubCategoryId);

    -- Log classification history
    INSERT INTO [dbo].[ClassificationHistory] (
        [Id], [ScreenshotId], [Category], [SubCategory], [TagsJson],
        [Confidence], [ModelName], [CreatedOn], [IsDeleted]
    ) VALUES (
        NEWID(), @ScreenshotId, COALESCE(@CatName, N'Uncategorized'), @SubCatName, N'[]',
        1.0, @ModelName, SYSUTCDATETIME(), 0
    );

    COMMIT TRANSACTION;

    SELECT 
        s.[Id], s.[CategoryId], c.[Name] AS [CategoryName],
        s.[SubCategoryId], sc.[Name] AS [SubCategoryName], s.[IsReviewed], s.[UpdatedOn]
    FROM [dbo].[Screenshots] s
    LEFT JOIN [dbo].[Categories] c ON s.[CategoryId] = c.[Id]
    LEFT JOIN [dbo].[Categories] sc ON s.[SubCategoryId] = sc.[Id]
    WHERE s.[Id] = @ScreenshotId;
END;
GO

-- 8. USP_GetPendingTasks (Retrieves pending tasks ordered by priority and due date)
CREATE OR ALTER PROCEDURE [dbo].[USP_GetPendingTasks]
    @UserId uniqueidentifier,
    @IncludeCompleted bit = 0,
    @Limit int = 50
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP (@Limit)
        t.[Id],
        t.[Title],
        t.[Description],
        t.[DueDate],
        t.[Priority],
        t.[Status],
        t.[IsCompleted],
        t.[CompletedAt],
        t.[ScreenshotId],
        s.[FileName] AS [ScreenshotFileName],
        t.[CategoryId],
        c.[Name] AS [CategoryName],
        t.[CreatedOn]
    FROM [dbo].[Tasks] t
    LEFT JOIN [dbo].[Screenshots] s ON t.[ScreenshotId] = s.[Id] AND s.[IsDeleted] = 0
    LEFT JOIN [dbo].[Categories] c ON t.[CategoryId] = c.[Id] AND c.[IsDeleted] = 0
    WHERE t.[UserId] = @UserId
      AND t.[IsDeleted] = 0
      AND (@IncludeCompleted = 1 OR t.[IsCompleted] = 0)
    ORDER BY 
        CASE t.[Priority] 
            WHEN N'Urgent' THEN 1 
            WHEN N'High' THEN 2 
            WHEN N'Medium' THEN 3 
            WHEN N'Low' THEN 4 
            ELSE 5 
        END,
        COALESCE(t.[DueDate], '2099-12-31') ASC,
        t.[CreatedOn] DESC;
END;
GO
