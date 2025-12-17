import { GoogleGenAI, Type } from "@google/genai";
import { DiarizedTurn } from "../types";

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
  return key.trim();
};

const API_KEY = getApiKey();

export const analyzeAudioFile = async (base64Data: string, mimeType: string): Promise<DiarizedTurn[]> => {
  if (!API_KEY) throw new Error("API Key not found. Please set VITE_API_KEY.");

  const ai = new GoogleGenAI({ apiKey: API_KEY });

  const prompt = `
    Listen to this audio conversation between a Customer and a Sales Rep. 
    1. Transcribe the audio verbatim.
    2. Identify the two distinct speakers.
    3. For each turn, identify the speaker.
    4. IF the speaker is the "Customer":
       - Perform Sentiment, Emotion, Intent, and Entity analysis.
       - ACT AS A SALES COACH: Provide 'suggestedQuestions', 'objectionHandling', and 'productRecommendations' for the Sales Rep to use in response.
    5. Return the result as a JSON array.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            speaker: { type: Type.STRING },
            text: { type: Type.STRING },
            // Analysis
            sentiment: { type: Type.STRING, enum: ["Positive", "Negative", "Neutral", "Mixed"] },
            emotion: { type: Type.STRING },
            intent: { type: Type.STRING },
            entities: { type: Type.ARRAY, items: { type: Type.STRING } },
            // Reasoning
            suggestions: {
              type: Type.OBJECT,
              properties: {
                suggestedQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
                objectionHandling: { type: Type.ARRAY, items: { type: Type.STRING } },
                productRecommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            }
          },
          required: ["speaker", "text"]
        }
      }
    }
  });

  const text = response.text;
  if (!text) return [];
  
  try {
    return JSON.parse(text) as DiarizedTurn[];
  } catch (e) {
    console.error("Failed to parse JSON response", e);
    return [];
  }
};