-- ============================================================================
-- ContextVault Database Architecture v1.0
-- Script 04: Performance Optimization & Full-Text Search Strategy
-- Target DBMS: Microsoft SQL Server 2022+ / Azure SQL / LocalDB
-- ============================================================================

USE [AIScreenshotOrganizerDb];
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- 1. Check & Create Full-Text Catalog
IF SERVERPROPERTY('IsFullTextInstalled') = 1
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.fulltext_catalogs WHERE name = N'ContextVaultCatalog')
    BEGIN
        CREATE FULLTEXT CATALOG [ContextVaultCatalog] AS DEFAULT;
        PRINT 'Full-Text Catalog ContextVaultCatalog created.';
    END

    -- Check & Create Full-Text Index on Screenshots(OCRText, VisionDescription)
    IF NOT EXISTS (
        SELECT 1 
        FROM sys.fulltext_indexes fi 
        JOIN sys.tables t ON fi.object_id = t.object_id 
        WHERE t.name = N'Screenshots'
    )
    BEGIN
        -- Find primary key index name on Screenshots
        DECLARE @PKName sysname = (
            SELECT i.name 
            FROM sys.indexes i
            JOIN sys.tables t ON i.object_id = t.object_id
            WHERE t.name = N'Screenshots' AND i.is_primary_key = 1
        );

        IF @PKName IS NOT NULL
        BEGIN
            DECLARE @Sql nvarchar(max) = N'
                CREATE FULLTEXT INDEX ON [dbo].[Screenshots](
                    [OCRText] LANGUAGE 1033,
                    [VisionDescription] LANGUAGE 1033
                )
                KEY INDEX [' + @PKName + N']
                ON [ContextVaultCatalog]
                WITH CHANGE_TRACKING AUTO;
            ';
            EXEC sp_executesql @Sql;
            PRINT 'Full-Text Index on Screenshots created successfully.';
        END
    END
END
ELSE
BEGIN
    PRINT 'Full-Text Search service is not installed on this SQL Server instance. Standard B-tree indexes will be used.';
END
GO

-- 2. COMPOSITE INDEXES FOR HIGH-THROUGHPUT QUERY PATHS

-- Timeline Index: Fast chronological queries by user
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Screenshots_User_CapturedDate' AND object_id = OBJECT_ID(N'[dbo].[Screenshots]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Screenshots_User_CapturedDate]
    ON [dbo].[Screenshots] ([UserId], [CapturedDate] DESC)
    INCLUDE ([FileName], [FileSize], [ImagePath], [ThumbnailPath], [CategoryId], [SubCategoryId], [Confidence], [IsFavorite])
    WHERE [IsDeleted] = 0;
END
GO

-- Smart Folder Filter Index: Fast retrieval of screenshots per Category/SubCategory
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Screenshots_User_Category' AND object_id = OBJECT_ID(N'[dbo].[Screenshots]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Screenshots_User_Category]
    ON [dbo].[Screenshots] ([UserId], [CategoryId], [SubCategoryId])
    INCLUDE ([CapturedDate], [FileName], [IsFavorite], [Confidence])
    WHERE [IsDeleted] = 0;
END
GO

-- Review Queue Index: Fast fetch of screenshots needing user review
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Screenshots_User_ReviewQueue' AND object_id = OBJECT_ID(N'[dbo].[Screenshots]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Screenshots_User_ReviewQueue]
    ON [dbo].[Screenshots] ([UserId], [IsReviewed])
    INCLUDE ([CapturedDate], [Confidence], [CategoryId])
    WHERE [IsDeleted] = 0 AND [IsReviewed] = 0;
END
GO

-- Category Hierarchy Traversal Index
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Categories_Parent_DisplayOrder' AND object_id = OBJECT_ID(N'[dbo].[Categories]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Categories_Parent_DisplayOrder]
    ON [dbo].[Categories] ([ParentCategoryId], [DisplayOrder], [Name])
    INCLUDE ([Icon], [Color], [CreatedByAI], [UserId])
    WHERE [IsDeleted] = 0;
END
GO

-- Concurrency Optimization: RowVersion lookup helper
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Screenshots_Id_RowVersion' AND object_id = OBJECT_ID(N'[dbo].[Screenshots]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Screenshots_Id_RowVersion]
    ON [dbo].[Screenshots] ([Id], [RowVersion]);
END
GO

PRINT 'Performance Optimization & Indexes script executed successfully.';
GO
