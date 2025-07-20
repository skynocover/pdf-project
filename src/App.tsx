import React, { useState, useCallback } from 'react';
import { FileText, Upload, Download, Plus, Trash2, Eye } from 'lucide-react';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

interface FileWithInfo {
  file: File;
  id: string;
  name: string;
  pageCount?: number;
}

function App() {
  const [mainDocument, setMainDocument] = useState<FileWithInfo | null>(null);
  const [attachments, setAttachments] = useState<FileWithInfo[]>([]);
  const [evidence, setEvidence] = useState<FileWithInfo[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fontBytes, setFontBytes] = useState<ArrayBuffer | null>(null);
  const [fontSize, setFontSize] = useState(16);

  // Load font that supports Chinese characters
  React.useEffect(() => {
    const loadFont = async () => {
      try {
        // Use a reliable CDN source for Chinese font
        const response = await fetch('https://fonts.gstatic.com/s/notosanssc/v36/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG9_FnYxNbPzS5HE.ttf');
        const arrayBuffer = await response.arrayBuffer();
        setFontBytes(arrayBuffer);
      } catch (error) {
        console.error('Failed to load font:', error);
        // Fallback: try to continue without custom font
        setFontBytes(null);
      }
    };
    loadFont();
  }, []);

  const handleFileUpload = useCallback((files: FileList | null, type: 'main' | 'attachment' | 'evidence') => {
    if (!files) return;

    const newFiles = Array.from(files).map(file => ({
      file,
      id: crypto.randomUUID(),
      name: file.name,
    }));

    if (type === 'main') {
      setMainDocument(newFiles[0] || null);
    } else if (type === 'attachment') {
      setAttachments(prev => [...prev, ...newFiles]);
    } else if (type === 'evidence') {
      setEvidence(prev => [...prev, ...newFiles]);
    }
  }, []);

  const removeFile = useCallback((id: string, type: 'main' | 'attachment' | 'evidence') => {
    if (type === 'main') {
      setMainDocument(null);
    } else if (type === 'attachment') {
      setAttachments(prev => prev.filter(f => f.id !== id));
    } else if (type === 'evidence') {
      setEvidence(prev => prev.filter(f => f.id !== id));
    }
  }, []);

  const addTextToPDF = async (pdfBytes: ArrayBuffer, text: string, pageNumberText: string, pageCount: number, fontBuffer: ArrayBuffer, textFontSize: number) => {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    let font;
    if (fontBuffer) {
      pdfDoc.registerFontkit(fontkit);
      font = await pdfDoc.embedFont(fontBuffer);
    } else {
      // Fallback to standard font if Chinese font fails
      font = await pdfDoc.embedFont('Helvetica');
    }
    
    const pages = pdfDoc.getPages();
    
    // Add title text to first page
    if (pages.length > 0) {
      const firstPage = pages[0];
      const { width, height } = firstPage.getSize();
      
      firstPage.drawText(text, {
        x: width - 100,
        y: height - 50,
        size: textFontSize,
        font,
        color: rgb(0, 0, 0),
      });
    }
    
    // Add page numbers to all pages
    pages.forEach((page, index) => {
      const { width, height } = page.getSize();
      page.drawText(`第 ${index + 1} 頁 共 ${pageCount} 頁`, {
        x: width - 120,
        y: 30,
        size: 10,
        font,
        color: rgb(0, 0, 0),
      });
    });
    
    return await pdfDoc.save();
  };

  const processAndMergePDFs = async () => {
    if (!mainDocument && attachments.length === 0 && evidence.length === 0) {
      alert('請至少上傳一個檔案');
      return;
    }

    if (!fontBytes) {
      alert('字體載入中，請稍後再試');
      return;
    }

    setIsProcessing(true);
    try {
      const mergedPdf = await PDFDocument.create();
      
      // Add main document (no processing)
      if (mainDocument) {
        const mainBytes = await mainDocument.file.arrayBuffer();
        const mainPdf = await PDFDocument.load(mainBytes);
        const mainPages = await mergedPdf.copyPages(mainPdf, mainPdf.getPageIndices());
        mainPages.forEach(page => mergedPdf.addPage(page));
      }
      
      // Process and add attachments
      for (let i = 0; i < attachments.length; i++) {
        const attachment = attachments[i];
        const attachmentBytes = await attachment.file.arrayBuffer();
        const attachmentPdf = await PDFDocument.load(attachmentBytes);
        const pageCount = attachmentPdf.getPageCount();
        
        const processedBytes = await addTextToPDF(
          attachmentBytes,
          `附件${i + 1}`,
          `第 {pageNum} 頁 共 ${pageCount} 頁`,
          pageCount,
          fontBytes
        );
        
        const processedPdf = await PDFDocument.load(processedBytes);
        const pages = await mergedPdf.copyPages(processedPdf, processedPdf.getPageIndices());
        pages.forEach(page => mergedPdf.addPage(page));
      }
      
      // Process and add evidence
      for (let i = 0; i < evidence.length; i++) {
        const evidenceFile = evidence[i];
        const evidenceBytes = await evidenceFile.file.arrayBuffer();
        const evidencePdf = await PDFDocument.load(evidenceBytes);
        const pageCount = evidencePdf.getPageCount();
        
        const processedBytes = await addTextToPDF(
          evidenceBytes,
          `證物${i + 1}`,
          `第 {pageNum} 頁 共 ${pageCount} 頁`,
          pageCount,
          fontBytes
        );
        
        const processedPdf = await PDFDocument.load(processedBytes);
        const pages = await mergedPdf.copyPages(processedPdf, processedPdf.getPageIndices());
        pages.forEach(page => mergedPdf.addPage(page));
      }
      
      const mergedBytes = await mergedPdf.save();
      const blob = new Blob([mergedBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      
    } catch (error) {
      console.error('處理PDF時發生錯誤:', error);
      alert('處理PDF時發生錯誤，請檢查檔案格式');
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadMergedPDF = () => {
    if (!previewUrl) return;
    
    const link = document.createElement('a');
    link.href = previewUrl;
    link.download = '整合文件.pdf';
    link.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-2">PDF 文件整合系統</h1>
          <p className="text-slate-600">上傳、編輯並整合您的PDF文件</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Panel - Controls */}
          <div className="space-y-6">
            {/* Main Document Section */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
              <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                書狀本文
              </h2>
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                {mainDocument ? (
                  <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg">
                    <span className="text-slate-700 font-medium">{mainDocument.name}</span>
                    <button
                      onClick={() => removeFile(mainDocument.id, 'main')}
                      className="text-red-500 hover:text-red-700 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-slate-600 mb-2">點擊上傳主要文件</p>
                    <p className="text-sm text-slate-500">支援 PDF 格式</p>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => handleFileUpload(e.target.files, 'main')}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Attachments Section */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
              <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-green-600" />
                附件
              </h2>
              <div className="space-y-3">
                {attachments.map((attachment, index) => (
                  <div key={attachment.id} className="flex items-center justify-between bg-slate-50 p-3 rounded-lg">
                    <span className="text-slate-700 font-medium">附件{index + 1}: {attachment.name}</span>
                    <button
                      onClick={() => removeFile(attachment.id, 'attachment')}
                      className="text-red-500 hover:text-red-700 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <label className="cursor-pointer border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:border-green-400 transition-colors block">
                  <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                  <p className="text-slate-600">添加附件</p>
                  <input
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={(e) => handleFileUpload(e.target.files, 'attachment')}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Evidence Section */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
              <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Eye className="w-5 h-5 text-purple-600" />
                證物
              </h2>
              <div className="space-y-3">
                {evidence.map((evidenceFile, index) => (
                  <div key={evidenceFile.id} className="flex items-center justify-between bg-slate-50 p-3 rounded-lg">
                    <span className="text-slate-700 font-medium">證物{index + 1}: {evidenceFile.name}</span>
                    <button
                      onClick={() => removeFile(evidenceFile.id, 'evidence')}
                      className="text-red-500 hover:text-red-700 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <label className="cursor-pointer border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:border-purple-400 transition-colors block">
                  <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                  <p className="text-slate-600">添加證物</p>
                  <input
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={(e) => handleFileUpload(e.target.files, 'evidence')}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Process Button */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
              <h2 className="text-xl font-semibold text-slate-800 mb-4">文字設定</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    字體大小: {fontSize}px
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="30"
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>10px</span>
                    <span>30px</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={processAndMergePDFs}
              disabled={isProcessing || (!mainDocument && attachments.length === 0 && evidence.length === 0)}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold py-4 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  處理中...
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5" />
                  整合文件
                </>
              )}
            </button>
          </div>

          {/* Right Panel - Preview */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
            <h2 className="text-xl font-semibold text-slate-800 mb-4">預覽</h2>
            {previewUrl ? (
              <div className="space-y-4">
                <div className="text-center">
                  <span className="text-slate-600 block mb-4">整合完成</span>
                  <button
                    onClick={downloadMergedPDF}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 transition-colors mx-auto"
                  >
                    <Download className="w-5 h-5" />
                    下載整合文件
                  </button>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <iframe
                    src={previewUrl}
                    className="w-full h-96"
                    title="PDF Preview"
                  />
                </div>
              </div>
            ) : (
              <div className="text-center py-16">
                <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">上傳檔案並點擊整合後，預覽將顯示在這裡</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;