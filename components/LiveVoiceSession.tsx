
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { decode, encode, decodeAudioData } from '../utils/audio';

interface LiveVoiceSessionProps {
  pdfContent: string;
  isActive: boolean;
  onToggle: (active: boolean) => void;
}

const LiveVoiceSession: React.FC<LiveVoiceSessionProps> = ({ pdfContent, isActive, onToggle }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [status, setStatus] = useState<string>('جاهز للمحادثة الصوتية');
  
  const audioContextInRef = useRef<AudioContext | null>(null);
  const audioContextOutRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const retryTimeoutRef = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    console.log('Cleaning up audio resources...');
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch (e) {}
      sessionRef.current = null;
    }
    
    activeSourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    activeSourcesRef.current.clear();
    
    if (audioContextInRef.current && audioContextInRef.current.state !== 'closed') {
      audioContextInRef.current.close().catch(() => {});
    }
    if (audioContextOutRef.current && audioContextOutRef.current.state !== 'closed') {
      audioContextOutRef.current.close().catch(() => {});
    }
  }, []);

  const stopSession = useCallback(() => {
    if (retryTimeoutRef.current) {
      window.clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    cleanup();
    onToggle(false);
    setIsConnecting(false);
    setStatus('تم إيقاف الجلسة');
  }, [onToggle, cleanup]);

  const startSession = async (retryAttempt = 0) => {
    // التأكد من وجود مفتاح API
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      setStatus('خطأ: لم يتم العثور على مفتاح API في إعدادات الموقع');
      console.error('API_KEY is missing from process.env');
      return;
    }

    setIsConnecting(true);
    setStatus('جاري طلب إذن الميكروفون...');

    try {
      // 1. طلب الميكروفون (يجب أن يكون عبر HTTPS)
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      streamRef.current = stream;

      // 2. إعداد سياقات الصوت (يجب أن تبدأ بعد نقرة المستخدم)
      const inCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      await inCtx.resume();
      await outCtx.resume();

      audioContextInRef.current = inCtx;
      audioContextOutRef.current = outCtx;

      setStatus('جاري الاتصال بخدمة Gemini...');
      const ai = new GoogleGenAI({ apiKey });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            console.log('Connected to Gemini Live API');
            setStatus('متصل! المعلم يسمعك الآن...');
            setIsConnecting(false);
            onToggle(true);
            
            const source = inCtx.createMediaStreamSource(stream);
            const scriptProcessor = inCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;
            
            scriptProcessor.onaudioprocess = (e) => {
              if (!sessionRef.current) return;
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const pcmBlob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              
              sessionPromise.then((session) => {
                try {
                  session.sendRealtimeInput({ media: pcmBlob });
                } catch (err) {
                  console.error('Failed to send audio input:', err);
                }
              });
            };
            
            source.connect(scriptProcessor);
            scriptProcessor.connect(inCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && audioContextOutRef.current) {
              const currentOutCtx = audioContextOutRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, currentOutCtx.currentTime);
              
              try {
                const audioBuffer = await decodeAudioData(decode(base64Audio), currentOutCtx, 24000, 1);
                const source = currentOutCtx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(currentOutCtx.destination);
                source.addEventListener('ended', () => activeSourcesRef.current.delete(source));
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                activeSourcesRef.current.add(source);
              } catch (decodeErr) {
                console.error('Audio decoding error:', decodeErr);
              }
            }
            
            if (message.serverContent?.interrupted) {
              activeSourcesRef.current.forEach(s => { try { s.stop(); } catch (e) {} });
              activeSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (e: any) => {
            console.error('Live API Error:', e);
            const errorMsg = String(e?.message || e || '').toLowerCase();
            
            if ((errorMsg.includes('unavailable') || errorMsg.includes('503')) && retryAttempt < 5) {
              const delay = Math.min(1000 * Math.pow(2, retryAttempt), 10000);
              setStatus(`الخدمة مشغولة، إعادة محاولة خلال ${delay/1000} ثوانٍ...`);
              cleanup();
              retryTimeoutRef.current = window.setTimeout(() => startSession(retryAttempt + 1), delay);
            } else {
              setStatus('انقطع الاتصال. يرجى التأكد من الإنترنت والمحاولة ثانية.');
              stopSession();
            }
          },
          onclose: () => {
            if (!retryTimeoutRef.current) {
               setStatus('انتهت الجلسة');
               stopSession();
            }
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: `أنت معلم دراسة عراقي ذكي وودود جداً. سياقك هو الملف التعليمي التالي: ${pdfContent.substring(0, 15000)}. 
          تكلم باللهجة البغدادية (أريد لهجة عراقية أصلية ومريحة). 
          ساعد الطالب بذكاء، شجعه بكلمات مثل "عاشت إيدك"، "بطل"، "منور". 
          إذا سألك عن شيء غير موجود بالملف، حاول ترجعه للموضوع بأسلوب حلو.`,
        }
      });
      
      sessionRef.current = await sessionPromise;
    } catch (error: any) {
      console.error('Failed to start session:', error);
      if (error.name === 'NotAllowedError') {
        setStatus('خطأ: يجب السماح للموقع باستخدام الميكروفون');
      } else {
        setStatus('عذراً، تعذر بدء المحادثة الصوتية حالياً.');
      }
      setIsConnecting(false);
      stopSession();
    }
  };

  return (
    <div className="flex flex-col items-center w-full">
      <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 transition-all duration-700 ${isActive ? 'bg-red-500 shadow-[0_0_40px_rgba(239,68,68,0.6)]' : 'bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.4)]'}`}>
        {isActive ? (
          <div className="flex gap-1.5 items-center h-10">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="w-1.5 bg-white rounded-full animate-bounce" style={{ height: `${30 + Math.random() * 30}%`, animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
        ) : (
          <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        )}
      </div>
      
      <p className="text-slate-700 font-bold mb-8 text-center min-h-[1.5rem] text-sm px-4 bg-slate-100 py-2 rounded-full border border-slate-200">{status}</p>
      
      <button
        onClick={isActive ? stopSession : () => startSession()}
        disabled={isConnecting}
        className={`w-full max-w-sm py-5 rounded-2xl font-black text-xl shadow-2xl transition-all transform active:scale-95 ${isActive 
          ? 'bg-white text-red-600 border-4 border-red-500 hover:bg-red-50' 
          : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-blue-300'} disabled:opacity-50`}
      >
        {isConnecting ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            جاري الاتصال...
          </span>
        ) : isActive ? 'إيقاف المعلم' : 'ابدأ التحدث مع المعلم'}
      </button>
      
      <div className="mt-8 text-slate-400 text-xs text-center px-6">
        {isActive ? 'المعلم يسمعك، تكلم الآن بكل أريحية' : 'تأكد من وجودك في مكان هادئ للحصول على أفضل تجربة'}
      </div>
    </div>
  );
};

export default LiveVoiceSession;
