# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a PDF processing application built with React, TypeScript, and Vite. The application allows users to merge multiple PDF documents and add Chinese text annotations (labels and page numbers) to attachments and evidence files.

## Key Technologies

- **Framework**: React 18.3 with TypeScript
- **Build Tool**: Vite 5.4
- **PDF Processing**: pdf-lib (with @pdf-lib/fontkit for Chinese font support)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **PDF Viewing**: react-pdf

## Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run ESLint
npm run lint

# Preview production build
npm run preview
```

## Architecture Overview

The application follows a single-page React architecture with the main logic contained in `src/App.tsx`:

1. **File Management**: The app manages three types of PDF files:
   - Main Document (書狀本文): Uploaded as-is without modifications
   - Attachments (附件): Labeled with "附件X" and page numbers
   - Evidence (證物): Labeled with "證物X" and page numbers

2. **PDF Processing Flow**:
   - Loads a Chinese font (Noto Sans SC) from Google Fonts CDN for proper text rendering
   - Uses pdf-lib to manipulate PDFs and add text annotations
   - Merges all documents into a single PDF maintaining the order: main → attachments → evidence
   - Generates a preview and allows download of the merged document

3. **State Management**: Uses React hooks (useState) for local state management of:
   - Uploaded files with metadata (id, name, pageCount)
   - Processing status
   - Preview URL
   - Font data and settings

4. **Key Functions**:
   - `handleFileUpload`: Manages file uploads for different document types
   - `addTextToPDF`: Adds Chinese text labels and page numbers to PDFs
   - `processAndMergePDFs`: Main function that orchestrates the PDF processing pipeline

## Important Notes

- The application requires Chinese font support, which is loaded from Google Fonts CDN
- All text content is in Traditional Chinese
- The build output goes to the `dist/` directory
- ESLint is configured with TypeScript and React hooks support