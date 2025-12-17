
import React from 'react';
import { Lightbulb, ShieldAlert, ShoppingBag, MessageCircleQuestion } from 'lucide-react';
import { AgentSuggestions } from '../types';

interface SalesAssistCardProps {
  suggestions: AgentSuggestions | undefined;
  isLoading?: boolean;
}

export const SalesAssistCard: React.FC<SalesAssistCardProps> = ({ suggestions, isLoading }) => {
  if (isLoading) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 animate-pulse mt-4">
        <div className="h-4 bg-slate-700 rounded w-1/2 mb-4"></div>
        <div className="space-y-2">
          <div className="h-16 bg-slate-700/50 rounded"></div>
        </div>
      </div>
    );
  }

  if (!suggestions) {
    return (
      <div className="mt-4 bg-slate-800/50 border border-slate-700 rounded-xl p-6 text-center text-slate-400">
        <Lightbulb className="w-10 h-10 mx-auto mb-2 opacity-30" />
        <p className="text-sm">AI Co-pilot is listening...</p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      
      {/* Suggested Questions */}
      <div className="bg-gradient-to-br from-indigo-900/40 to-slate-900 border border-indigo-500/30 rounded-xl p-4 shadow-lg">
        <div className="flex items-center gap-2 text-indigo-300 font-semibold mb-3 border-b border-indigo-500/20 pb-2">
          <MessageCircleQuestion className="w-4 h-4" />
          <h3>Suggested Responses</h3>
        </div>
        <ul className="space-y-2">
          {suggestions.suggestedQuestions && suggestions.suggestedQuestions.length > 0 ? (
            suggestions.suggestedQuestions.map((q, i) => (
              <li key={i} className="text-sm text-slate-200 bg-slate-800/50 p-2 rounded-lg border border-slate-700/50 hover:border-indigo-500/50 transition-colors">
                "{q}"
              </li>
            ))
          ) : (
            <li className="text-xs text-slate-500 italic">No specific suggestions at the moment.</li>
          )}
        </ul>
      </div>

      {/* Objection Handling */}
      {suggestions.objectionHandling && suggestions.objectionHandling.length > 0 && (
        <div className="bg-gradient-to-br from-amber-900/30 to-slate-900 border border-amber-500/30 rounded-xl p-4 shadow-lg">
          <div className="flex items-center gap-2 text-amber-400 font-semibold mb-3 border-b border-amber-500/20 pb-2">
            <ShieldAlert className="w-4 h-4" />
            <h3>Objection Handling</h3>
          </div>
          <ul className="space-y-2">
             {suggestions.objectionHandling.map((obj, i) => (
               <li key={i} className="text-sm text-slate-200 bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
                 {obj}
               </li>
             ))}
          </ul>
        </div>
      )}

      {/* Product Recommendations */}
      <div className="bg-gradient-to-br from-emerald-900/30 to-slate-900 border border-emerald-500/30 rounded-xl p-4 shadow-lg">
        <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-3 border-b border-emerald-500/20 pb-2">
          <ShoppingBag className="w-4 h-4" />
          <h3>Recommended Products</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {suggestions.productRecommendations && suggestions.productRecommendations.length > 0 ? (
            suggestions.productRecommendations.map((prod, i) => (
              <span key={i} className="px-2.5 py-1.5 bg-emerald-500/10 text-emerald-300 text-xs font-medium rounded-md border border-emerald-500/20">
                {prod}
              </span>
            ))
          ) : (
            <span className="text-xs text-slate-500 italic">Listening for context...</span>
          )}
        </div>
      </div>

    </div>
  );
};
