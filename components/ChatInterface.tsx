
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { Message } from '../types';

interface ChatInterfaceProps {
  pdfContent: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ pdfContent }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'مرحباً بك! لقد قرأت الملف، كيف يمكنني مساعدتك في دراسته اليوم؟' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage: Message = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          { role: 'user', parts: [{ text: `سياق الدراسة (نص ملف PDF): ${pdfContent.substring(0, 20000)}` }] },
          ...messages.map(m => ({
            role: m.role,
            parts: [{ text: m.text }]
          })),
          { role: 'user', parts: [{ text: input }] }
        ],
        config: {
          systemInstruction: 'أنت معلم دراسة خبير. أجب باختصار ووضوح باللغة العربية. استخدم المعلومات الموجودة في نص الملف المقدم حصراً للإجابة على الأسئلة المتعلقة به. إذا سألك الطالب عن شيء خارج الملف، حاول ربطه بمحتوى الملف إن أمكن.',
          temperature: 0.7,
        }
      });

      const modelText = response.text || 'عذراً، لم أستطع فهم ذلك.';
      setMessages(prev => [...prev, { role: 'model', text: modelText }]);
    } catch (error) {
      console.error('Chat Error:', error);
      setMessages(prev => [...prev, { role: 'model', text: 'حدث خطأ أثناء محاولة الرد. يرجى المحاولة مرة أخرى.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-4 bg-slate-50 border-b border-slate-100 font-bold text-slate-700">
        دردشة المعلم
      </div>
      
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[400px]">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed ${
              m.role === 'user' 
                ? 'bg-blue-600 text-white rounded-tr-none' 
                : 'bg-slate-100 text-slate-800 rounded-tl-none'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-end">
            <div className="bg-slate-100 p-3 rounded-2xl rounded-tl-none flex gap-1">
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" />
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-100 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="اسأل المعلم عن أي شيء في الملف..."
          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
        />
        <button
          onClick={handleSend}
          disabled={isTyping}
          className="bg-blue-600 text-white p-2 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <svg className="w-5 h-5 transform rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ChatInterface;
