import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { Mic, MicOff, AlertCircle, Activity, User, Users, MessageSquare, Sparkles, Download } from 'lucide-react';
import { createPcmBlob, decodeAudioData, base64ToUint8Array } from '../utils/audioUtils';
import { downloadTranscriptAsText } from '../utils/downloadUtils';
import { AnalysisData, SessionStatus, TranscriptItem } from '../types';
import { AnalysisCard } from './AnalysisCard';
import { SalesAssistCard } from './SalesAssistCard';

// Helper to get API Key safely in both Node/Studio and Vite environments
const getApiKey = (): string => {
  let key = '';
  try {
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
      key = process.env.API_KEY;
    }
  } catch (e) {
    // process not defined
  }
  
  if (!key) {
    try {
      // @ts-ignore - Vite specific
      if (import.meta && import.meta.env && import.meta.env.VITE_API_KEY) {
        // @ts-ignore
        key = import.meta.env.VITE_API_KEY;
      }
    } catch (e) {
      // import.meta not defined
    }
  }
  // Sanitize key: remove quotes, spaces
  return key.replace(/["']/g, "").trim();
};

// Updated Unified Tool with AI Reasoning fields
const logTurnTool: FunctionDeclaration = {
  name: 'logTurn',
  description: 'Log a transcribed conversation turn from the audio and provide analysis + sales coaching suggestions.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      speaker: { 
        type: Type.STRING, 
        description: 'Speaker identification: "Customer" or "Sales Rep". Default to "Sales Rep" if unsure.' 
      },
      text: { 
        type: Type.STRING, 
        description: 'Verbatim text spoken by the speaker.' 
      },
      // Analysis Fields (Customer only)
      sentiment: { 
        type: Type.STRING, 
        description: 'Customer sentiment: Positive, Negative, Neutral, or Mixed.'
      },
      emotion: { 
        type: Type.STRING, 
        description: 'Customer emotion, e.g., Frustrated, Happy, Curious.' 
      },
      intent: { 
        type: Type.STRING,
        description: 'Customer intent, e.g., Buy, Complain, Inquire.' 
      },
      entities: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING },
        description: 'Key entities mentioned by the Customer.' 
      },
      // AI Reasoning / Sales Assist Fields (Triggered when Customer speaks)
      suggestedQuestions: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: '3 bullet points: Smart follow-up questions the Sales Rep should ask next.'
      },
      objectionHandling: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'If the customer raises an objection, provide 1-2 counter-points or empathy statements. Otherwise empty.'
      },
      productRecommendations: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'List of relevant products or services based on the conversation context.'
      }
    },
    required: ['speaker', 'text']
  }
};

export const LiveSession: React.FC = () => {
  const [status, setStatus] = useState<SessionStatus>(SessionStatus.IDLE);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [latestAnalysis, setLatestAnalysis] = useState<AnalysisData | undefined>(undefined);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentText, setCurrentText] = useState<string>(''); // Streaming text

  // Audio Context Refs
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  // State Refs for Closures
  const currentInputTransRef = useRef<string>('');
  const sessionRef = useRef<any>(null); // To store the active session object
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const cleanupAudio = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (inputContextRef.current) {
      inputContextRef.current.close().catch(() => {});
      inputContextRef.current = null;
    }
    if (outputContextRef.current) {
      outputContextRef.current.close().catch(() => {});
      outputContextRef.current = null;
    }
    // Stop all playing audio
    audioSourcesRef.current.forEach(src => {
      try { src.stop(); } catch(e) {}
    });
    audioSourcesRef.current.clear();
  }, []);

  const startSession = async () => {
    setErrorMsg(null);
    setStatus(SessionStatus.CONNECTING);
    setTranscripts([]);
    setCurrentText('');
    currentInputTransRef.current = '';

    const apiKey = getApiKey();
    if (!apiKey) {
      setErrorMsg("API Key not found. Please set VITE_API_KEY in your .env file.");
      setStatus(SessionStatus.ERROR);
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      
      // Setup Audio - Use system default sample rate for maximum compatibility
      inputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Output context for model audio
      outputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      streamRef.current = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          echoCancellation: true,
          autoGainControl: true,
          noiseSuppression: true,
        } 
      });

      const config = {
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO], 
          inputAudioTranscription: {}, 
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } }
          },
          systemInstruction: `
            You are a backend transcript analyst for a real-time Sales conversation.
            
            Input: Live audio stream.
            Output: Use the 'logTurn' tool.
            
            ROLES:
            1. **Sales Rep (User)**: The primary voice you hear. This is the person wearing the microphone. ALWAYS identify the main speaker as "Sales Rep".
            2. **Customer**: The other person. Only identify as "Customer" if the context clearly shows they are buying/inquiring.

            INSTRUCTIONS:
            - Ignore silence and background noise. Do not log empty turns.
            - If you are unsure who is speaking, assume it is the "Sales Rep".
            - When the "Customer" speaks, use the tool to provide "sentiment", "intent", and "suggestedQuestions" for the Sales Rep.
            - You may remain silent (generate empty audio) if no analysis is needed, but keep the session active.
          `,
          tools: [{ functionDeclarations: [logTurnTool] }]
        }
      };

      const sessionPromise = ai.live.connect({
        ...config,
        callbacks: {
          onopen: async () => {
            setStatus(SessionStatus.CONNECTED);
            
            if (!inputContextRef.current || !streamRef.current) return;
            
            const ctx = inputContextRef.current;
            // Ensure context is running
            if (ctx.state === 'suspended') {
              await ctx.resume();
            }

            const source = ctx.createMediaStreamSource(streamRef.current);
            const processor = ctx.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              // CRITICAL: We pass the system sample rate, and createPcmBlob will downsample to 16000
              const pcmBlob = createPcmBlob(inputData, ctx.sampleRate);
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
              }).catch(e => {
                // Ignore send errors if session is closed
              });
            };
            
            source.connect(processor);
            processor.connect(ctx.destination);
            
            processorRef.current = processor;
            sourceRef.current = source;
          },
          onmessage: async (msg: LiveServerMessage) => {
            // Handle Tool Calls
            if (msg.toolCall) {
              const responses = msg.toolCall.functionCalls.map(fc => {
                if (fc.name === 'logTurn') {
                  try {
                    const args = fc.args as any;
                    
                    // Filter empty turns or hallucinations
                    if (!args.text || args.text.trim().length < 2) {
                       return {
                        id: fc.id,
                        name: fc.name,
                        response: { result: "ok" }
                      };
                    }

                    const newTranscript: TranscriptItem = {
                      id: fc.id,
                      speaker: args.speaker || 'Sales Rep',
                      text: args.text,
                      timestamp: new Date().toLocaleTimeString()
                    };
                    
                    setTranscripts(prev => [...prev, newTranscript]);

                    // Only update analysis if it's explicitly the Customer
                    if (args.speaker?.toLowerCase().includes('customer')) {
                      setLatestAnalysis({
                        sentiment: args.sentiment || 'Neutral',
                        emotion: args.emotion || 'N/A',
                        intent: args.intent || 'Unknown',
                        entities: args.entities || [],
                        suggestions: {
                          suggestedQuestions: args.suggestedQuestions || [],
                          objectionHandling: args.objectionHandling || [],
                          productRecommendations: args.productRecommendations || []
                        }
                      });
                    }

                    return {
                      id: fc.id,
                      name: fc.name,
                      response: { result: "ok" }
                    };
                  } catch (e) {
                    console.error("Error parsing tool args", e);
                    return {
                      id: fc.id,
                      name: fc.name,
                      response: { result: "error" }
                    };
                  }
                }
                return {
                  id: fc.id,
                  name: fc.name,
                  response: { result: "ok" }
                };
              });

              if (responses.length > 0) {
                sessionPromise.then(session => {
                  session.sendToolResponse({
                    functionResponses: responses
                  });
                });
              }
            }

            // Handle Streaming Input Transcription (Live Captions)
            if (msg.serverContent?.inputTranscription) {
              const text = msg.serverContent.inputTranscription.text;
              currentInputTransRef.current += text;
              setCurrentText(currentInputTransRef.current);
            }

            if (msg.serverContent?.turnComplete) {
               currentInputTransRef.current = '';
               setCurrentText('');
            }
          },
          onclose: () => {
            setStatus(SessionStatus.IDLE);
            cleanupAudio();
          },
          onerror: (err) => {
            console.error("Session Error:", err);
            setErrorMsg(`Session Error: ${err.message || 'Service unavailable or connection lost'}`);
            setStatus(SessionStatus.ERROR);
            cleanupAudio();
          }
        }
      });
      
      // Catch initial connection failures
      sessionPromise.catch(err => {
         console.error("Connection Failed:", err);
         setErrorMsg(`Connection Failed: ${err.message || 'Check Internet or API Key'}`);
         setStatus(SessionStatus.ERROR);
         cleanupAudio();
      });

      sessionRef.current = sessionPromise;

    } catch (e: any) {
      console.error(e);
      setErrorMsg(`Failed to initialize session: ${e.message}`);
      setStatus(SessionStatus.ERROR);
      cleanupAudio();
    }
  };

  const stopSession = () => {
    cleanupAudio();
    setStatus(SessionStatus.IDLE);
    setCurrentText('');
    setLatestAnalysis(undefined);
    if (sessionRef.current) {
        // Attempt to close properly if supported
        sessionRef.current.then((s: any) => {
            if (s.close) s.close();
        }).catch(() => {});
        sessionRef.current = null;
    }
  };

  const handleDownload = () => {
    downloadTranscriptAsText(transcripts, `live-transcript-${new Date().toISOString()}.txt`);
  };

  useEffect(() => {
    return () => {
      stopSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
      {/* Left Column: Controls & Transcript (8 cols) */}
      <div className="lg:col-span-8 flex flex-col gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 flex items-center justify-between shadow-lg">
          <div>
            <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-400" />
              Live Sales Copilot
            </h2>
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Users className="w-4 h-4" />
              <span>Diarization & Real-time Reasoning Active</span>
            </div>
          </div>
          
          {status === SessionStatus.IDLE || status === SessionStatus.ERROR || status === SessionStatus.CONNECTING ? (
            <button 
              onClick={startSession}
              disabled={status === SessionStatus.CONNECTING}
              className={`flex items-center gap-2 text-white px-6 py-3 rounded-lg font-semibold transition-all shadow-lg ${
                  status === SessionStatus.CONNECTING 
                  ? 'bg-slate-600 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-cyan-900/20'
              }`}
            >
              {status === SessionStatus.CONNECTING ? 'Connecting...' : (
                  <>
                    <Mic className="w-5 h-5" />
                    Start Session
                  </>
              )}
            </button>
          ) : (
            <button 
              onClick={stopSession}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-lg font-semibold transition-all shadow-lg shadow-red-900/20"
            >
              <MicOff className="w-5 h-5" />
              End Session
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-lg flex items-center gap-2 text-red-200">
            <AlertCircle className="w-5 h-5" />
            {errorMsg}
          </div>
        )}

        <div className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-4 overflow-hidden flex flex-col min-h-[500px] shadow-inner">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-4">
             <div className="flex items-center gap-2">
               <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                 <MessageSquare className="w-3 h-3" />
                 Conversation Transcript
               </h3>
               {status === SessionStatus.CONNECTED && (
                 <span className="flex items-center gap-2 text-xs text-green-400 animate-pulse ml-2">
                   <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                   Listening
                 </span>
               )}
             </div>
             
             {transcripts.length > 0 && (
               <button 
                 onClick={handleDownload}
                 className="text-xs flex items-center gap-1 text-slate-400 hover:text-cyan-400 transition-colors"
                 title="Download Transcript"
               >
                 <Download className="w-3 h-3" />
                 Download
               </button>
             )}
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-2">
            {transcripts.length === 0 && !currentText && status === SessionStatus.CONNECTED && (
              <p className="text-slate-600 italic text-center mt-20">Waiting for conversation to start...</p>
            )}
            
            {transcripts.map((item) => {
              const isCustomer = item.speaker.toLowerCase().includes('customer');
              return (
                <div key={item.id} className={`flex flex-col gap-1 ${isCustomer ? 'items-end' : 'items-start'}`}>
                   <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${isCustomer ? 'text-cyan-400' : 'text-purple-400'}`}>
                        {item.speaker}
                      </span>
                      <span className="text-xs text-slate-600">{item.timestamp}</span>
                   </div>
                   <div className={`p-4 rounded-xl max-w-[85%] shadow-md ${
                     isCustomer 
                       ? 'bg-cyan-900/10 border border-cyan-800/50 rounded-tr-none text-slate-200' 
                       : 'bg-slate-800 border border-slate-700 rounded-tl-none text-slate-300'
                   }`}>
                     <p className="text-sm md:text-base leading-relaxed">
                       {item.text}
                     </p>
                   </div>
                </div>
              );
            })}

            {/* Live Captions */}
            {currentText && (
              <div className="flex flex-col items-center gap-1 mt-4 opacity-80">
                 <p className="text-slate-400 text-sm italic bg-slate-800/50 px-6 py-3 rounded-full border border-slate-700/50 animate-pulse">
                   {currentText}
                 </p>
              </div>
            )}
            
            <div ref={(el) => el?.scrollIntoView({ behavior: 'smooth' })} />
          </div>
        </div>
      </div>

      {/* Right Column: AI Analysis & Reasoning (4 cols) */}
      <div className="lg:col-span-4 space-y-6 overflow-y-auto custom-scrollbar h-full pb-4">
        
        {/* Basic Analysis */}
        <div>
          <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
            <User className="w-4 h-4" />
            Customer Sentiment
          </h3>
          <AnalysisCard 
            data={latestAnalysis} 
            isLoading={status === SessionStatus.CONNECTED && !latestAnalysis && transcripts.length > 0} 
          />
        </div>

        {/* AI Reasoning / Sales Copilot */}
        <div>
           <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            AI Reasoning Layer
          </h3>
          <SalesAssistCard 
            suggestions={latestAnalysis?.suggestions} 
            isLoading={status === SessionStatus.CONNECTED && !latestAnalysis?.suggestions && transcripts.length > 0} 
          />
        </div>

        {/* Stats */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 mt-auto">
          <h4 className="text-white font-medium mb-3 text-sm">Session Metrics</h4>
          <div className="text-xs text-slate-400 space-y-2">
            <div className="flex justify-between border-b border-slate-700/50 pb-1">
              <span>Model</span>
              <span>Gemini 2.5 Flash</span>
            </div>
            <div className="flex justify-between border-b border-slate-700/50 pb-1">
              <span>Latency</span>
              <span className="text-green-400">Real-time</span>
            </div>
            <div className="flex justify-between pt-1">
               <span>Turns Processed</span>
               <span>{transcripts.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};