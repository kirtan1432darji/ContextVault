-- ============================================================================
-- ContextVault Database Architecture v1.0
-- Script 02: Seed Data (Categories, Subcategories, Tags, AI Models)
-- Target DBMS: Microsoft SQL Server 2022+ / Azure SQL / LocalDB
-- Note: Idempotent script; checks before inserting.
-- ============================================================================

USE [AIScreenshotOrganizerDb];
GO

SET NOCOUNT ON;

-- ============================================================================
-- 1. SEED AI MODELS
-- ============================================================================
PRINT 'Seeding AI Models...';

MERGE INTO [dbo].[AIModels] AS target
USING (VALUES
    (N'gemma-vision', N'Gemma Vision', N'Google DeepMind', N'1.0', 8192, 1, N'["OCR", "Classification", "EntityExtraction"]'),
    (N'qwen-vl', N'Qwen VL', N'Alibaba Cloud', N'2.0', 16384, 1, N'["VisionQA", "DocumentAnalysis", "OCR"]'),
    (N'gemini-vision', N'Gemini Vision', N'Google Cloud', N'1.5-Pro', 32768, 1, N'["DeepReasoning", "FolderContext", "Chat", "CodeExtraction"]')
) AS source ([ModelCode], [DisplayName], [Provider], [Version], [MaxContextTokens], [IsActive], [CapabilitiesJson])
ON target.[ModelCode] = source.[ModelCode]
WHEN MATCHED THEN
    UPDATE SET 
        target.[DisplayName] = source.[DisplayName],
        target.[Provider] = source.[Provider],
        target.[Version] = source.[Version],
        target.[MaxContextTokens] = source.[MaxContextTokens],
        target.[IsActive] = source.[IsActive],
        target.[CapabilitiesJson] = source.[CapabilitiesJson],
        target.[UpdatedOn] = SYSUTCDATETIME()
WHEN NOT MATCHED THEN
    INSERT ([Id], [ModelCode], [DisplayName], [Provider], [Version], [MaxContextTokens], [IsActive], [CapabilitiesJson], [CreatedOn])
    VALUES (NEWID(), source.[ModelCode], source.[DisplayName], source.[Provider], source.[Version], source.[MaxContextTokens], source.[IsActive], source.[CapabilitiesJson], SYSUTCDATETIME());

GO

-- ============================================================================
-- 2. SEED SYSTEM TAGS
-- ============================================================================
PRINT 'Seeding System Tags...';

DECLARE @SystemTags TABLE ([Name] nvarchar(50));
INSERT INTO @SystemTags ([Name]) VALUES 
    (N'Important'),
    (N'Bug'),
    (N'Invoice'),
    (N'Meeting'),
    (N'Shopping'),
    (N'Learning'),
    (N'Reference'),
    (N'Personal');

INSERT INTO [dbo].[Tags] ([Id], [Name], [UserId], [CreatedDate], [CreatedOn], [IsDeleted])
SELECT NEWID(), s.[Name], NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 0
FROM @SystemTags s
WHERE NOT EXISTS (
    SELECT 1 FROM [dbo].[Tags] t 
    WHERE t.[Name] = s.[Name] AND t.[UserId] IS NULL AND t.[IsDeleted] = 0
);
GO

-- ============================================================================
-- 3. SEED SMART FOLDER CATEGORIES & HIERARCHY
-- ============================================================================
PRINT 'Seeding Categories & Smart Folder Hierarchy...';

-- Helper table for parent categories
DECLARE @Parents TABLE (
    [TempId] int IDENTITY(1,1),
    [Name] nvarchar(100),
    [Icon] nvarchar(50),
    [Color] nvarchar(20),
    [DisplayOrder] int,
    [Description] nvarchar(500)
);

INSERT INTO @Parents ([Name], [Icon], [Color], [DisplayOrder], [Description]) VALUES
    (N'Projects', N'folder_special', N'#6366F1', 1, N'Active engineering, design, and work project captures'),
    (N'Shopping', N'shopping_cart', N'#F44336', 2, N'Purchases, wishlists, carts, deals, and product comparisons'),
    (N'Learning', N'school', N'#10B981', 3, N'Tutorials, study notes, tech articles, and educational content'),
    (N'Meetings', N'groups', N'#8B5CF6', 4, N'Meeting notes, slide captures, agendas, and whiteboard photos'),
    (N'Finance', N'account_balance', N'#059669', 5, N'Bank statements, tax records, transactions, and bills'),
    (N'Travel', N'flight', N'#0EA5E9', 6, N'Boarding passes, tickets, hotel bookings, and travel guides'),
    (N'Personal', N'person', N'#EC4899', 7, N'Private captures, memories, family notes, and health records'),
    (N'Social', N'forum', N'#F59E0B', 8, N'Chat threads, messages, social posts, and memes'),
    (N'Documents', N'description', N'#64748B', 9, N'Official IDs, contracts, agreements, and official paperwork');

-- Ensure root categories exist
DECLARE @pName nvarchar(100), @pIcon nvarchar(50), @pColor nvarchar(20), @pOrder int, @pDesc nvarchar(500);
DECLARE parent_cursor CURSOR LOCAL FAST_FORWARD FOR 
    SELECT [Name], [Icon], [Color], [DisplayOrder], [Description] FROM @Parents;

OPEN parent_cursor;
FETCH NEXT FROM parent_cursor INTO @pName, @pIcon, @pColor, @pOrder, @pDesc;

WHILE @@FETCH_STATUS = 0
BEGIN
    IF NOT EXISTS (SELECT 1 FROM [dbo].[Categories] WHERE [Name] = @pName AND [UserId] IS NULL AND [IsDeleted] = 0)
    BEGIN
        INSERT INTO [dbo].[Categories] ([Id], [Name], [ParentCategoryId], [Icon], [Color], [CreatedByAI], [UserId], [DisplayOrder], [Description], [CreatedDate], [CreatedOn], [IsDeleted])
        VALUES (NEWID(), @pName, NULL, @pIcon, @pColor, 0, NULL, @pOrder, @pDesc, SYSUTCDATETIME(), SYSUTCDATETIME(), 0);
    END
    FETCH NEXT FROM parent_cursor INTO @pName, @pIcon, @pColor, @pOrder, @pDesc;
END

CLOSE parent_cursor;
DEALLOCATE parent_cursor;

-- Helper table for child subcategories
DECLARE @Subs TABLE (
    [ParentName] nvarchar(100),
    [SubName] nvarchar(100),
    [DisplayOrder] int
);

INSERT INTO @Subs ([ParentName], [SubName], [DisplayOrder]) VALUES
    -- Projects
    (N'Projects', N'NHDC', 1),
    (N'Projects', N'Mobile Apps', 2),
    (N'Projects', N'Backend Services', 3),
    (N'Projects', N'Bug Reports', 4),

    -- Shopping
    (N'Shopping', N'Diwali', 1),
    (N'Shopping', N'Electronics', 2),
    (N'Shopping', N'Fashion', 3),
    (N'Shopping', N'Amazon & Flipkart', 4),

    -- Learning
    (N'Learning', N'Flutter', 1),
    (N'Learning', N'ASP.NET Core', 2),
    (N'Learning', N'AI & LLMs', 3),
    (N'Learning', N'Architecture', 4),

    -- Meetings
    (N'Meetings', N'Sprint Reviews', 1),
    (N'Meetings', N'Architecture Sync', 2),
    (N'Meetings', N'Standup Notes', 3),

    -- Finance
    (N'Finance', N'Receipts & Bills', 1),
    (N'Finance', N'UPI & Banking', 2),
    (N'Finance', N'Taxes & Investments', 3),

    -- Travel
    (N'Travel', N'Flight Tickets', 1),
    (N'Travel', N'Hotel Bookings', 2),
    (N'Travel', N'Itineraries', 3),

    -- Personal
    (N'Personal', N'Medical & Health', 1),
    (N'Personal', N'Reminders', 2),
    (N'Personal', N'Family & Friends', 3),

    -- Social
    (N'Social', N'WhatsApp Chats', 1),
    (N'Social', N'Twitter / X', 2),
    (N'Social', N'Memes', 3),

    -- Documents
    (N'Documents', N'Government IDs', 1),
    (N'Documents', N'Agreements & Leases', 2),
    (N'Documents', N'Certificates', 3);

-- Insert Level-2 Subcategories
DECLARE @parentCatName nvarchar(100), @subCatName nvarchar(100), @sOrder int;
DECLARE sub_cursor CURSOR LOCAL FAST_FORWARD FOR
    SELECT [ParentName], [SubName], [DisplayOrder] FROM @Subs;

OPEN sub_cursor;
FETCH NEXT FROM sub_cursor INTO @parentCatName, @subCatName, @sOrder;

WHILE @@FETCH_STATUS = 0
BEGIN
    DECLARE @parentId uniqueidentifier = (SELECT TOP 1 [Id] FROM [dbo].[Categories] WHERE [Name] = @parentCatName AND [ParentCategoryId] IS NULL AND [UserId] IS NULL AND [IsDeleted] = 0);
    
    IF @parentId IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM [dbo].[Categories] 
        WHERE [Name] = @subCatName AND [ParentCategoryId] = @parentId AND [UserId] IS NULL AND [IsDeleted] = 0
    )
    BEGIN
        INSERT INTO [dbo].[Categories] ([Id], [Name], [ParentCategoryId], [Icon], [Color], [CreatedByAI], [UserId], [DisplayOrder], [Description], [CreatedDate], [CreatedOn], [IsDeleted])
        VALUES (NEWID(), @subCatName, @parentId, N'subdirectory_arrow_right', NULL, 0, NULL, @sOrder, @parentCatName + ' > ' + @subCatName, SYSUTCDATETIME(), SYSUTCDATETIME(), 0);
    END

    FETCH NEXT FROM sub_cursor INTO @parentCatName, @subCatName, @sOrder;
END

CLOSE sub_cursor;
DEALLOCATE sub_cursor;

-- Insert Level-3 Subcategory Example: Projects -> NHDC -> Payroll
DECLARE @nhdcId uniqueidentifier = (SELECT TOP 1 [Id] FROM [dbo].[Categories] WHERE [Name] = N'NHDC' AND [ParentCategoryId] IS NOT NULL AND [UserId] IS NULL AND [IsDeleted] = 0);
IF @nhdcId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [dbo].[Categories] WHERE [Name] = N'Payroll' AND [ParentCategoryId] = @nhdcId AND [IsDeleted] = 0)
BEGIN
    INSERT INTO [dbo].[Categories] ([Id], [Name], [ParentCategoryId], [Icon], [Color], [CreatedByAI], [UserId], [DisplayOrder], [Description], [CreatedDate], [CreatedOn], [IsDeleted])
    VALUES (NEWID(), N'Payroll', @nhdcId, N'payments', NULL, 0, NULL, 1, N'NHDC Project Payroll Documents', SYSUTCDATETIME(), SYSUTCDATETIME(), 0);
END

-- Insert Level-3 Subcategory Example: Shopping -> Diwali -> Shoes
DECLARE @diwaliId uniqueidentifier = (SELECT TOP 1 [Id] FROM [dbo].[Categories] WHERE [Name] = N'Diwali' AND [ParentCategoryId] IS NOT NULL AND [UserId] IS NULL AND [IsDeleted] = 0);
IF @diwaliId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [dbo].[Categories] WHERE [Name] = N'Shoes' AND [ParentCategoryId] = @diwaliId AND [IsDeleted] = 0)
BEGIN
    INSERT INTO [dbo].[Categories] ([Id], [Name], [ParentCategoryId], [Icon], [Color], [CreatedByAI], [UserId], [DisplayOrder], [Description], [CreatedDate], [CreatedOn], [IsDeleted])
    VALUES (NEWID(), N'Shoes', @diwaliId, N'shopping_bag', NULL, 0, NULL, 1, N'Diwali Festive Footwear Wishlist', SYSUTCDATETIME(), SYSUTCDATETIME(), 0);
END

PRINT 'Seed Data Completed Successfully.';
GO
