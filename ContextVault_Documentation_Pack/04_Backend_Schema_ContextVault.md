# ContextVault Backend Schema

## Architecture
FastAPI + SQLAlchemy + SQL Server.

## Core Modules
- Auth
- Screenshots
- Classification
- Context
- Search
- Chat

## Database Tables
Users, Categories, Screenshots, OCRCache, FolderContexts, ClassificationHistory, Tags, SearchIndex, ChatHistory.

## APIs
/auth/*
/screenshots/*
/classification/*
/context/*
/chat/*
/search/*

## Scalability
Repository pattern, Alembic migrations, background sync queue.
