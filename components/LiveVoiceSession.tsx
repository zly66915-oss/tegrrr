
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

  const stopSession = useCallback(() => {
    if (sessionRef.current) {
      // In a real scenario, we'd call session.close() if available
      sessionRef.current = null;
    }
    
    activeSourcesRef.current.forEach(source => source.stop());
    activeSourcesRef.current.clear();
    
    if (audioContextInRef.current) {
      audioContextInRef.current.close();
      audioContextInRef.current = null;
    }
    if (audioContextOutRef.current) {
      audioContextOutRef.current.close();
      audioContextOutRef.current = null;
    }
    
    onToggle(false);
    setIsConnecting(false);
    setStatus('تم إنهاء الجلسة');
  }, [onToggle]);

  const startSession = async () => {
    setIsConnecting(true);
    setStatus('جاري الاتصال بـ Gemini...');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      
      audioContextInRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextOutRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setStatus('متصل! تحدث الآن...');
            setIsConnecting(false);
            
            const source = audioContextInRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = audioContextInRef.current!.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const pcmBlob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextInRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && audioContextOutRef.current) {
              const outCtx = audioContextOutRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outCtx.currentTime);
              
              const audioBuffer = await decodeAudioData(decode(base64Audio), outCtx, 24000, 1);
              const source = outCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outCtx.destination);
              
              source.addEventListener('ended', () => {
                activeSourcesRef.current.delete(source);
              });
              
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              activeSourcesRef.current.add(source);
            }
            
            if (message.serverContent?.interrupted) {
              activeSourcesRef.current.forEach(s => s.stop());
              activeSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (e) => {
            console.error('Live API Error:', e);
            setStatus('حدث خطأ في الاتصال');
            stopSession();
          },
          onclose: () => {
            console.log('Live session closed');
            stopSession();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: `أنت معلم دراسة ذكي ومحفز من العراق. سياقك هو الملف التعليمي التالي: ${pdfContent.substring(0, 10000)}. 
          يجب أن تتحدث باللهجة العراقية الودودة والمحفزة بوضوح تام. 
          ساعد الطالب في فهم المفاهيم المعقدة، اسأله أسئلة لاختبار فهمه باللهجة العراقية، وكن دائماً مشجعاً بعبارات عراقية أصيلة مثل "عاشت إيدك"، "بطل"، "منور"، "تدلل عيوني". 
          اجعل الطالب يشعر وكأنه يجلس مع أستاذ عراقي حقيقي في البيت.`,
        }
      });
      
      sessionRef.current = await sessionPromise;
      onToggle(true);
    } catch (error) {
      console.error('Failed to start Live session:', error);
      setStatus('فشل بدء الجلسة الصوتية');
      setIsConnecting(false);
    }
  };

  return (
    <div className="flex flex-col items-center p-6 bg-white rounded-2xl shadow-sm border border-slate-100">
      <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-all duration-500 ${isActive ? 'bg-red-100 animate-pulse' : 'bg-blue-100'}`}>
        {isActive ? (
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        ) : (
          <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        )}
      </div>
      
      <p className="text-sm font-medium text-slate-600 mb-6">{status}</p>
      
      <button
        onClick={isActive ? stopSession : startSession}
        disabled={isConnecting}
        className={`px-8 py-3 rounded-xl font-bold transition-all ${isActive 
          ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-200' 
          : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200'} disabled:opacity-50`}
      >
        {isConnecting ? 'جاري الاتصال...' : isActive ? 'إيقاف المعلم' : 'بدء المحادثة الصوتية'}
      </button>
      
      {isActive && (
        <div className="mt-4 flex gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="w-1 bg-blue-400 h-4 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
      )}
    </div>
  );
};

export default LiveVoiceSession;
