
import React, { useState } from 'react';
import { Upload, FileAudio, CheckCircle, AlertCircle, Loader2, Sparkles, User, Download } from 'lucide-react';
import { analyzeAudioFile } from '../services/geminiService';
import { downloadTranscriptAsText } from '../utils/downloadUtils';
import { DiarizedTurn } from '../types';
import { AnalysisCard } from './AnalysisCard';
import { SalesAssistCard } from './SalesAssistCard';

export const UploadSession: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<DiarizedTurn[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTurnIndex, setSelectedTurnIndex] = useState<number | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResults(null);
      setError(null);
    }
  };

  const processFile = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = (reader.result as string).split(',')[1];
        try {
          const data = await analyzeAudioFile(base64String, file.type);
          setResults(data);
          // Auto-select first customer turn for analysis view
          const firstCustomer = data.findIndex(d => d.speaker.toLowerCase().includes('customer') || d.speaker.toLowerCase().includes('speaker 2'));
          setSelectedTurnIndex(firstCustomer !== -1 ? firstCustomer : 0);
        } catch (err) {
          setError("Analysis failed. Please try a shorter audio clip or check format.");
          console.error(err);
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (e) {
      setError("Error reading file.");
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (results) {
      let fileName = `upload-transcript-${new Date().toISOString()}.txt`;
      
      if (file) {
        const lastDotIndex = file.name.lastIndexOf('.');
        if (lastDotIndex !== -1) {
           fileName = file.name.substring(0, lastDotIndex) + '.txt';
        } else {
           fileName = file.name + '.txt';
        }
      }
      
      downloadTranscriptAsText(results, fileName);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
      {/* Left: Upload and Transcript (8 cols) */}
      <div className="lg:col-span-8 flex flex-col gap-6">
        
        {/* Upload Area */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center border-dashed border-2 border-slate-600 hover:border-cyan-500 transition-colors">
          <input 
            type="file" 
            accept="audio/*" 
            onChange={handleFileChange} 
            className="hidden" 
            id="audio-upload"
          />
          <label htmlFor="audio-upload" className="cursor-pointer flex flex-col items-center">
            {file ? (
              <>
                <FileAudio className="w-12 h-12 text-cyan-400 mb-4" />
                <p className="text-lg font-medium text-white">{file.name}</p>
                <p className="text-slate-400 text-sm mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </>
            ) : (
              <>
                <Upload className="w-12 h-12 text-slate-500 mb-4" />
                <p className="text-lg font-medium text-slate-300">Click to upload Audio</p>
                <p className="text-slate-500 text-sm mt-1">MP3, WAV, AAC supported</p>
              </>
            )}
          </label>

          {file && !isProcessing && !results && (
            <button 
              onClick={processFile}
              className="mt-6 bg-cyan-600 hover:bg-cyan-500 text-white px-8 py-2 rounded-full font-semibold transition-all"
            >
              Start Analysis
            </button>
          )}

          {isProcessing && (
            <div className="mt-6 flex items-center justify-center gap-2 text-cyan-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Processing with Gemini...</span>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-lg flex items-center gap-2 text-red-200">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* Transcript Results */}
        {results && (
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 overflow-hidden flex flex-col h-[600px] shadow-inner">
             <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
               <div className="flex items-center gap-3">
                 <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">
                    Full Transcript
                 </h3>
                 <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded">
                   {results.length} turns
                 </span>
               </div>
               
               <button 
                 onClick={handleDownload}
                 className="text-xs flex items-center gap-1 text-slate-400 hover:text-cyan-400 transition-colors"
                 title="Download Transcript"
               >
                 <Download className="w-3 h-3" />
                 Download
               </button>
             </div>
             <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
               {results.map((turn, idx) => {
                 const isCustomer = turn.speaker.toLowerCase().includes('customer') || turn.speaker.toLowerCase().includes('speaker 2');
                 const isSelected = selectedTurnIndex === idx;
                 
                 return (
                   <div 
                     key={idx} 
                     onClick={() => setSelectedTurnIndex(idx)}
                     className={`p-4 rounded-lg cursor-pointer transition-all border ${
                       isSelected 
                         ? 'bg-slate-800 border-cyan-500/50 shadow-md shadow-cyan-900/10' 
                         : 'bg-transparent border-transparent hover:bg-slate-800/50'
                     }`}
                   >
                     <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold ${isCustomer ? 'text-green-400' : 'text-blue-400'}`}>
                          {turn.speaker}
                        </span>
                        {isCustomer && turn.sentiment && (
                          <span className="text-[10px] uppercase bg-slate-700 text-slate-300 px-1 rounded">
                            {turn.sentiment}
                          </span>
                        )}
                     </div>
                     <p className="text-slate-200 text-sm leading-relaxed">
                       {turn.text}
                     </p>
                   </div>
                 );
               })}
             </div>
          </div>
        )}
      </div>

      {/* Right: Selected Analysis (4 cols) */}
      <div className="lg:col-span-4 space-y-6 overflow-y-auto custom-scrollbar h-full pb-4">
        
        {/* Basic Analysis */}
        <div>
           <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
             <User className="w-4 h-4" />
             Turn Analysis
           </h3>
           <div className="sticky top-4">
             {selectedTurnIndex !== null && results ? (
               results[selectedTurnIndex].speaker.toLowerCase().includes('customer') || results[selectedTurnIndex].speaker.toLowerCase().includes('speaker 2') ? (
                 <AnalysisCard 
                   data={{
                     sentiment: results[selectedTurnIndex].sentiment as any || 'Neutral',
                     emotion: results[selectedTurnIndex].emotion || 'N/A',
                     intent: results[selectedTurnIndex].intent || 'N/A',
                     entities: results[selectedTurnIndex].entities || [],
                     suggestions: results[selectedTurnIndex].suggestions
                   }} 
                 />
               ) : (
                 <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-center">
                    <p className="text-slate-400 mb-2">Sales Rep / Agent Turn</p>
                    <p className="text-sm text-slate-500">Select a Customer turn to see analysis.</p>
                 </div>
               )
             ) : (
               <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-center text-slate-500">
                 Select a transcript turn to view details.
               </div>
             )}
           </div>
        </div>

        {/* AI Reasoning */}
        {selectedTurnIndex !== null && results && (results[selectedTurnIndex].speaker.toLowerCase().includes('customer') || results[selectedTurnIndex].speaker.toLowerCase().includes('speaker 2')) && (
          <div>
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
               <Sparkles className="w-4 h-4 text-amber-400" />
               AI Reasoning Layer
            </h3>
            <SalesAssistCard 
               suggestions={results[selectedTurnIndex].suggestions} 
            />
          </div>
        )}

      </div>
    </div>
  );
};
