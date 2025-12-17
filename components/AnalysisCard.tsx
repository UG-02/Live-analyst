import React from 'react';
import { Activity, Heart, Target, Tag } from 'lucide-react';
import { AnalysisData } from '../types';

interface AnalysisCardProps {
  data: AnalysisData | undefined;
  isLoading?: boolean;
}

export const AnalysisCard: React.FC<AnalysisCardProps> = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-slate-700 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-20 bg-slate-700/50 rounded"></div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 text-center text-slate-400">
        <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>Waiting for speech input to analyze...</p>
      </div>
    );
  }

  const getSentimentColor = (s: string) => {
    switch (s?.toLowerCase()) {
      case 'positive': return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'negative': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'mixed': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-700">
        <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <Activity className="w-5 h-5 text-cyan-400" />
          Real-time Analysis
        </h3>
        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getSentimentColor(data.sentiment)}`}>
          {data.sentiment || 'Neutral'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Emotion */}
        <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <Heart className="w-4 h-4" />
            <span>Detected Emotion</span>
          </div>
          <p className="text-slate-100 font-medium capitalize">{data.emotion || 'N/A'}</p>
        </div>

        {/* Intent */}
        <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <Target className="w-4 h-4" />
            <span>User Intent</span>
          </div>
          <p className="text-slate-100 font-medium">{data.intent || 'Unknown'}</p>
        </div>
      </div>

      {/* Entities */}
      <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
        <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
          <Tag className="w-4 h-4" />
          <span>Extracted Entities</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.entities && data.entities.length > 0 ? (
            data.entities.map((entity, i) => (
              <span key={i} className="px-2 py-1 bg-cyan-900/30 text-cyan-300 text-xs rounded border border-cyan-800/50">
                {entity}
              </span>
            ))
          ) : (
            <span className="text-slate-500 text-sm italic">No entities detected</span>
          )}
        </div>
      </div>
    </div>
  );
};
