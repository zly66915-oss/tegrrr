
import React, { useState } from 'react';
import FileUpload from './components/FileUpload';
import LiveVoiceSession from './components/LiveVoiceSession';
import { PdfData, AppState } from './types';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [pdfData, setPdfData] = useState<PdfData | null>(null);
  const [isVoiceActive, setIsVoiceActive] = useState(false);

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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-none">معلم الدراسة الذكي</h1>
            <p className="text-xs text-slate-500 mt-1">مدعوم بـ Gemini 2.5 Native Audio</p>
          </div>
        </div>
        
        {appState === AppState.STUDYING && (
          <button 
            onClick={reset}
            className="text-sm font-medium text-slate-500 hover:text-red-600 transition-colors flex items-center gap-2"
          >
            <span>ملف جديد</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto p-4 md:p-8 max-w-4xl">
        {appState === AppState.IDLE && (
          <div className="max-w-2xl mx-auto mt-12 text-center">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-slate-900 mb-4">ابدأ رحلتك الدراسية الذكية</h2>
              <p className="text-slate-600">ارفع ملف PDF الخاص بمادتك الدراسية، وسيقوم المعلم الذكي بتحليله ومناقشته معك صوتياً.</p>
            </div>
            <FileUpload onProcessed={handleFileProcessed} isProcessing={appState === AppState.LOADING} />
          </div>
        )}

        {appState === AppState.STUDYING && pdfData && (
          <div className="max-w-2xl mx-auto space-y-8 animate-fadeIn">
            {/* File Info Card */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="bg-blue-500 p-3 rounded-xl shadow-md shadow-blue-100">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">الملف الحالي</h3>
                  <p className="text-lg font-bold text-slate-800 truncate max-w-[250px]">{pdfData.name}</p>
                </div>
              </div>
              
              <div className="text-right">
                <p className="text-xs text-slate-500">تم استخراج النص بنجاح</p>
                <p className="text-xs font-medium text-green-600">المعلم جاهز للنقاش</p>
              </div>
            </div>

            {/* Main Voice Interaction Area */}
            <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col items-center">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-slate-800 mb-2">معلمك الصوتي الذكي</h2>
                <p className="text-slate-500 text-sm max-w-sm mx-auto">
                  اضغط على الزر أدناه لبدء جلسة مذاكرة تفاعلية. يمكنك طرح الأسئلة أو طلب شرح مفاهيم الملف بصوتك.
                </p>
              </div>

              <LiveVoiceSession 
                pdfContent={pdfData.content} 
                isActive={isVoiceActive} 
                onToggle={setIsVoiceActive} 
              />

              <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                <div className="p-4 bg-slate-50 rounded-2xl text-center">
                  <div className="text-blue-500 mb-2 flex justify-center">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </div>
                  <p className="text-xs font-bold text-slate-700">تفاعل طبيعي</p>
                  <p className="text-[10px] text-slate-500 mt-1">ناقش الدروس وكأنك مع معلم حقيقي</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl text-center">
                  <div className="text-blue-500 mb-2 flex justify-center">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <p className="text-xs font-bold text-slate-700">شرح عميق</p>
                  <p className="text-[10px] text-slate-500 mt-1">تبسيط أعقد المفاهيم في الملف</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl text-center">
                  <div className="text-blue-500 mb-2 flex justify-center">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                  <p className="text-xs font-bold text-slate-700">اختبار الفهم</p>
                  <p className="text-[10px] text-slate-500 mt-1">سيقوم المعلم بسؤالك للتأكد من استيعابك</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-slate-400 text-xs border-t border-slate-200 bg-white">
        تم التطوير باستخدام تقنيات Google Gemini 2.5 و React
      </footer>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default App;
