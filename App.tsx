
import React, { useState, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import LiveVoiceSession from './components/LiveVoiceSession';
import ChatInterface from './components/ChatInterface';
import { PdfData, AppState } from './types';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [pdfData, setPdfData] = useState<PdfData | null>(null);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [studyMode, setStudyMode] = useState<'voice' | 'chat'>('voice');
  const [apiKeyError, setApiKeyError] = useState(false);

  useEffect(() => {
    // فحص أولي لمفتاح الـ API
    if (!process.env.API_KEY) {
      console.warn("API_KEY is missing. Make sure to set it in Netlify Environment Variables.");
      setApiKeyError(true);
    }
  }, []);

  const handleFileProcessed = (name: string, content: string) => {
    setPdfData({ name, content });
    setAppState(AppState.STUDYING);
  };

  const reset = () => {
    setPdfData(null);
    setAppState(AppState.IDLE);
    setIsVoiceActive(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-['Tajawal']">
      {/* API Key Warning Overlay */}
      {apiKeyError && (
        <div className="fixed top-0 left-0 w-full bg-red-600 text-white p-2 text-center text-xs z-[100] font-bold shadow-lg">
          ⚠️ تنبيه: مفتاح API غير موجود. يرجى إضافته في إعدادات Netlify ليعمل التطبيق.
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">معلم الدراسة الذكي</h1>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">Gemini 2.5 Intelligence</p>
          </div>
        </div>
        
        {appState === AppState.STUDYING && (
          <button onClick={reset} className="text-sm font-bold text-slate-400 hover:text-red-500 transition-colors flex items-center gap-2">
            <span>ملف جديد</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto p-4 md:p-6 max-w-4xl">
        {appState === AppState.IDLE ? (
          <div className="max-w-xl mx-auto mt-12 text-center animate-fadeIn">
            <div className="mb-10">
              <div className="inline-block bg-blue-50 text-blue-600 px-4 py-1.5 rounded-full text-xs font-bold mb-4">نسخة المعلم v2.5</div>
              <h2 className="text-4xl font-black text-slate-900 mb-4 leading-tight">ادرس بذكاء مع جيميناي</h2>
              <p className="text-slate-600 text-lg">ارفع كتابك بصيغة PDF وسأقوم بشرحه لك صوتياً أو نصياً.</p>
            </div>
            <FileUpload onProcessed={handleFileProcessed} isProcessing={appState === AppState.LOADING} />
          </div>
        ) : (
          <div className="space-y-6 animate-fadeIn">
            {/* Control Bar */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-4">
                <div className="bg-slate-100 p-2.5 rounded-lg">
                  <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">قيد الدراسة</p>
                  <p className="text-sm font-bold text-slate-800 truncate max-w-[200px]">{pdfData?.name}</p>
                </div>
              </div>

              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button 
                  onClick={() => setStudyMode('voice')}
                  className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${studyMode === 'voice' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  صوتي
                </button>
                <button 
                  onClick={() => setStudyMode('chat')}
                  className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${studyMode === 'chat' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  دردشة
                </button>
              </div>
            </div>

            {/* Main Interactive Content */}
            <div className="grid grid-cols-1 gap-6">
              {studyMode === 'voice' ? (
                <div className="bg-white p-10 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col items-center">
                  <div className="text-center mb-10">
                    <h3 className="text-2xl font-bold text-slate-900 mb-2">المعلم الصوتي</h3>
                    <p className="text-slate-500 text-sm">ناقش محتوى الملف صوتياً باللهجة العراقية</p>
                  </div>
                  <LiveVoiceSession 
                    pdfContent={pdfData?.content || ''} 
                    isActive={isVoiceActive} 
                    onToggle={setIsVoiceActive} 
                  />
                  <div className="mt-12 flex flex-wrap justify-center gap-3">
                    <span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-3 py-1 rounded-full">استجابة لحظية</span>
                    <span className="bg-purple-50 text-purple-600 text-[10px] font-bold px-3 py-1 rounded-full">لهجة بغدادية</span>
                    <span className="bg-green-50 text-green-600 text-[10px] font-bold px-3 py-1 rounded-full">تحليل ذكي</span>
                  </div>
                </div>
              ) : (
                <div className="h-[600px] animate-fadeIn">
                  <ChatInterface pdfContent={pdfData?.content || ''} />
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="py-8 text-center bg-white border-t border-slate-100 mt-auto">
        <p className="text-slate-400 text-[11px] font-medium uppercase tracking-widest">Powered by Google Gemini 2.5</p>
      </footer>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
};

export default App;
