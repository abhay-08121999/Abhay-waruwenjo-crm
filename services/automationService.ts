/**
 * ⚠️ CRITICAL SECURITY WARNING ⚠️
 * 
 * This file exposes your Gemini API key in client-side code - a SERIOUS SECURITY VULNERABILITY.
 * 
 * PROBLEM:
 * - API key is accessible in browser JavaScript (process.env.API_KEY)
 * - Anyone can extract and misuse your API key from the browser
 * - This can lead to unauthorized usage and unexpected costs
 * 
 * RECOMMENDED SOLUTION:
 * - Move all AI/automation logic to a secure backend server
 * - Frontend sends requests to YOUR backend API
 * - Backend securely stores and uses the API key
 * 
 * DO NOT USE IN PRODUCTION without proper backend security implementation.
 */

import { GoogleGenAI, Type } from "@google/genai";
import { Lead, LeadStatus, FacilityType } from "../types.ts";
import { MOCK_INBOUND_FEED as CONSTANT_FEED } from "../constants.tsx";

const getGeminiClient = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("Gemini API key is missing. AI automation features will be disabled.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const parseRawMessageToLead = async (content: string, source: 'Email' | 'WhatsApp'): Promise<Partial<Lead> | null> => {
  try {
    const ai = getGeminiClient();
    if (!ai) return null;

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: `Extract healthcare facility lead information from the following ${source} content. 
      Analyze names of physicians, facility types, and specific medical equipment or services mentioned.
      
      Message: "${content}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Doctor or Decision maker name" },
            company: { type: Type.STRING, description: "Facility name" },
            email: { type: Type.STRING },
            phone: { type: Type.STRING },
            facilityType: {
              type: Type.STRING,
              description: "Must be one of: Hospital, Clinic, Laboratory, Pharmacy, Other"
            },
            value: { type: Type.NUMBER, description: "Estimated potential contract value in USD" },
            notes: { type: Type.STRING, description: "Brief summary of the inquiry" },
            specialty: { type: Type.STRING }
          },
          required: ["name", "company", "facilityType", "notes"]
        }
      }
    });

    const parsed = JSON.parse(response.text);
    return {
      ...parsed,
      status: LeadStatus.NEW,
      lastContact: new Date().toISOString().split('T')[0],
      assignedTo: "AI System"
    };
  } catch (error) {
    console.error("Automation Parsing Error:", error);
    return null;
  }
};

export const MOCK_INBOUND_FEED = CONSTANT_FEED;
