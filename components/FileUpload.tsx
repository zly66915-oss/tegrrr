
import React, { useState } from 'react';

interface FileUploadProps {
  onProcessed: (name: string, content: string) => void;
  isProcessing: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onProcessed, isProcessing }) => {
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('يرجى اختيار ملف PDF فقط');
      return;
    }

    setError(null);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const typedarray = new Uint8Array(event.target?.result as ArrayBuffer);
        
        // Use global pdfjs from CDN
        const pdfjsLib = (window as any)['pdfjs-dist/build/pdf'];
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        let fullText = '';
        
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          fullText += pageText + '\n';
        }

        if (fullText.trim().length === 0) {
          throw new Error('لا يمكن استخراج النص من هذا الملف');
        }

        onProcessed(file.name, fullText);
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error('PDF Processing error:', err);
      setError('فشل في قراءة ملف PDF. قد يكون الملف محمياً أو تالفاً.');
    }
  };

  return (
    <div className="w-full">
      <label className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-3xl cursor-pointer transition-all ${isProcessing ? 'bg-slate-50 border-slate-200' : 'bg-white border-blue-200 hover:border-blue-400 hover:bg-blue-50'}`}>
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <svg className={`w-12 h-12 mb-4 ${isProcessing ? 'text-slate-300 animate-spin' : 'text-blue-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isProcessing ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            )}
          </svg>
          <p className="mb-2 text-lg font-bold text-slate-700">
            {isProcessing ? 'جاري معالجة الملف...' : 'اضغط هنا لرفع ملف الدراسة (PDF)'}
          </p>
          <p className="text-sm text-slate-500">سأقوم بتحليل المحتوى لتدريسك إياه</p>
        </div>
        <input type="file" className="hidden" accept=".pdf" onChange={handleFileChange} disabled={isProcessing} />
      </label>
      {error && <p className="mt-2 text-sm text-red-500 text-center font-medium">{error}</p>}
    </div>
  );
};

export default FileUpload;
