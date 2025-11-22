import { GoogleGenAI } from "@google/genai";

// Initialize Gemini Client
// NOTE: Ensure process.env.API_KEY is available in the environment
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const MODEL_NAME = 'gemini-2.5-flash';

export const generateCommentary = async (
  event: 'intro' | 'score_p1' | 'score_p2' | 'game_over',
  scoreP1: number,
  scoreP2: number
): Promise<string> => {
  if (!process.env.API_KEY) {
    return "AI Commentary Unavailable (Missing API Key)";
  }

  let prompt = "";
  const scoreContext = `Current score: Player 1 (Cyan) ${scoreP1} - ${scoreP2} Player 2 (Magenta).`;

  switch (event) {
    case 'intro':
      prompt = "Give a short, high-energy, 1-sentence intro for a futuristic neon air hockey match between Cyan and Magenta.";
      break;
    case 'score_p1':
      prompt = `Player 1 just scored! ${scoreContext} Give a short, 1-sentence excited sci-fi sports commentary praising Player 1.`;
      break;
    case 'score_p2':
      prompt = `Player 2 just scored! ${scoreContext} Give a short, 1-sentence excited sci-fi sports commentary praising Player 2.`;
      break;
    case 'game_over':
      const winner = scoreP1 > scoreP2 ? "Player 1" : "Player 2";
      prompt = `Game Over! ${winner} wins! ${scoreContext} Give a 1-sentence concluding remark.`;
      break;
  }

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction: "You are a futuristic sports announcer named 'Gemini-X'. You speak in short, punchy, high-energy bursts. Use words like 'Laser', 'Velocity', 'Cyber', 'Strike'. Keep it under 20 words.",
        temperature: 0.9,
      }
    });
    
    return response.text || "Commentary signal lost...";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Connecting to AI commentator...";
  }
};
