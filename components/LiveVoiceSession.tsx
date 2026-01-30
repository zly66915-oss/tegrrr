
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
        if (typeof sessionRef.current.close === 'function') {
          sessionRef.current.close();
        }
      } catch (e) {}
      sessionRef.current = null;
    }
    
    activeSourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    activeSourcesRef.current.clear();
    
    if (audioContextInRef.current) {
      audioContextInRef.current.close().catch(() => {});
      audioContextInRef.current = null;
    }
    if (audioContextOutRef.current) {
      audioContextOutRef.current.close().catch(() => {});
      audioContextOutRef.current = null;
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
    setStatus('تم إيقاف المعلم');
  }, [onToggle, cleanup]);

  const startSession = async (retryAttempt = 0) => {
    if (!process.env.API_KEY) {
      setStatus('خطأ: مفتاح API مفقود');
      return;
    }

    setIsConnecting(true);
    setStatus(retryAttempt > 0 ? `إعادة محاولة الاتصال (${retryAttempt}/5)...` : 'جاري فتح قناة الصوت...');

    try {
      // 1. طلب الميكروفون أولاً
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      streamRef.current = stream;

      // 2. إنشاء سياقات الصوت بعد تفاعل المستخدم
      const inCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      await inCtx.resume();
      await outCtx.resume();

      audioContextInRef.current = inCtx;
      audioContextOutRef.current = outCtx;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            console.log('Gemini Live Connection Established');
            setStatus('المعلم يستمع إليك الآن...');
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
                try { session.sendRealtimeInput({ media: pcmBlob }); } catch (err) {}
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
              } catch (err) {}
            }
            
            if (message.serverContent?.interrupted) {
              activeSourcesRef.current.forEach(s => { try { s.stop(); } catch (e) {} });
              activeSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (e: any) => {
            console.error('Live API Error:', e);
            const errorStr = String(e?.message || e || '').toLowerCase();
            
            if ((errorStr.includes('unavailable') || errorStr.includes('503')) && retryAttempt < 5) {
              const delay = Math.min(1000 * Math.pow(2, retryAttempt), 10000);
              setStatus('الخدمة مشغولة، جاري المحاولة مرة أخرى...');
              cleanup();
              retryTimeoutRef.current = window.setTimeout(() => startSession(retryAttempt + 1), delay);
            } else {
              setStatus('فشل الاتصال. تأكد من الإنترنت وحاول لاحقاً.');
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
          systemInstruction: `أنت معلم دراسة عراقي ذكي. استخدم نص الملف المقدم: ${pdfContent.substring(0, 15000)}. 
          تكلم باللهجة البغدادية المريحة. شجع الطالب بكلمات مثل "عاشت إيدك" و "بطل". 
          إذا كان الملف غير واضح، حاول مساعدة الطالب في فهم الأساسيات.`,
        }
      });
      
      sessionRef.current = await sessionPromise;
    } catch (error: any) {
      console.error('Start Error:', error);
      if (error.name === 'NotAllowedError') {
        setStatus('يجب السماح بالوصول للميكروفون من إعدادات المتصفح');
      } else {
        setStatus('عذراً، الخدمة غير متاحة حالياً. جرب المحادثة النصية.');
      }
      setIsConnecting(false);
      stopSession();
    }
  };

  return (
    <div className="flex flex-col items-center w-full">
      <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-all duration-700 ${isActive ? 'bg-red-500 shadow-[0_0_30px_rgba(239,68,68,0.5)]' : 'bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.3)]'}`}>
        {isActive ? (
          <div className="flex gap-1 items-center h-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="w-1.5 bg-white rounded-full animate-pulse" style={{ height: `${20 + Math.random() * 20}px`, animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        ) : (
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        )}
      </div>
      
      <p className="text-slate-600 font-medium mb-6 text-center h-6 text-sm">{status}</p>
      
      <button
        onClick={isActive ? stopSession : () => startSession()}
        disabled={isConnecting}
        className={`w-full max-w-xs py-4 rounded-2xl font-bold text-lg transition-all transform active:scale-95 ${isActive 
          ? 'bg-red-50 text-red-600 border-2 border-red-200 hover:bg-red-100' 
          : 'bg-blue-600 text-white hover:bg-blue-700 shadow-xl shadow-blue-200'} disabled:opacity-50`}
      >
        {isConnecting ? 'جاري الاتصال...' : isActive ? 'إيقاف المعلم' : 'تحدث مع المعلم'}
      </button>
    </div>
  );
};

export default LiveVoiceSession;
