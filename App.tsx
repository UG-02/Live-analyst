import React, { useState } from 'react';
import { Mic, UploadCloud, Radio, Settings2 } from 'lucide-react';
import { LiveSession } from './components/LiveSession';
import { UploadSession } from './components/UploadSession';

function App() {
  const [activeTab, setActiveTab] = useState<'live' | 'upload'>('live');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-cyan-500/30">
      
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-cyan-500/10 p-2 rounded-lg">
              <Radio className="w-6 h-6 text-cyan-400" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              AI Sales Assistant 
            </h1>
          </div>
          
          <div className="flex bg-slate-800 p-1 rounded-lg">
            <button 
              onClick={() => setActiveTab('live')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === 'live' 
                  ? 'bg-slate-700 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Mic className="w-4 h-4" />
              Live Speech
            </button>
            <button 
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === 'upload' 
                  ? 'bg-slate-700 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UploadCloud className="w-4 h-4" />
              Upload Audio
            </button>
          </div>
          
          <button className="p-2 text-slate-400 hover:text-white transition-colors">
            <Settings2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'live' ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
             <LiveSession />
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
             <UploadSession />
          </div>
        )}
      </main>

    </div>
  );
}

export default App;
