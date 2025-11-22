
import React, { useState, useEffect } from 'react';
import GameCanvas from './components/GameCanvas';
import { GameState, GameCommentary } from './types';
import { generateCommentary } from './services/geminiService';
import { GoogleGenAI } from "@google/genai";

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [commentary, setCommentary] = useState<GameCommentary | null>(null);
  const [apiKeyAvailable, setApiKeyAvailable] = useState(false);
  const [resetGameKey, setResetGameKey] = useState(0);

  useEffect(() => {
     if (process.env.API_KEY) {
         setApiKeyAvailable(true);
     }
  }, []);

  const startGame = async () => {
    setGameState(GameState.PLAYING);
    // Trigger intro commentary
    if (process.env.API_KEY) {
        try {
            const text = await generateCommentary('intro', 0, 0);
            setCommentary({ text, timestamp: Date.now(), type: 'intro' });
        } catch (e) {
            console.warn("Intro commentary failed");
        }
    }
  };

  const handleRestart = () => {
    setResetGameKey(prev => prev + 1);
    setCommentary({ text: "Match Reset! New Game!", timestamp: Date.now(), type: 'hype' });
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 font-display">
      {/* Header */}
      <header className="w-full max-w-6xl flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-cyan-500 rounded-full shadow-[0_0_10px_#06b6d4]"></div>
            <div className="w-3 h-3 bg-magenta-500 rounded-full shadow-[0_0_10px_#d946ef]"></div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500">
                NEON HAND HOCKEY
            </h1>
        </div>
        <div className="text-xs text-gray-500 font-mono">
             POWERED BY GEMINI & MEDIAPIPE
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative w-full max-w-6xl aspect-video bg-gray-900/50 rounded-2xl ring-1 ring-white/10 shadow-2xl overflow-hidden">
        
        {/* Game Canvas Layer (Background) */}
        <GameCanvas 
            gameState={gameState} 
            setGameState={setGameState} 
            onCommentary={setCommentary}
            resetTrigger={resetGameKey}
        />

        {/* Restart Button Overlay - Only visible when playing */}
        {gameState === GameState.PLAYING && (
            <button 
                onClick={handleRestart}
                className="absolute top-4 right-4 z-50 flex items-center gap-2 px-4 py-2 bg-black/60 hover:bg-cyan-900/60 border border-cyan-500/50 text-cyan-400 rounded-full text-xs md:text-sm font-bold tracking-wider backdrop-blur-md transition-all hover:scale-105 hover:shadow-[0_0_10px_rgba(6,182,212,0.4)]"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                RESTART
            </button>
        )}

        {/* Menu Overlay Layer (Z-50 to ensure clickability) */}
        {gameState === GameState.MENU && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-black/80 backdrop-blur-sm transition-all duration-500">
                <h2 className="text-5xl md:text-7xl font-bold mb-8 text-center animate-pulse">
                    <span className="text-cyan-500">CYAN</span> VS <span className="text-fuchsia-500">MAGENTA</span>
                </h2>
                
                <div className="bg-gray-900/90 p-6 rounded-lg border border-gray-800 max-w-md text-center mb-8 backdrop-blur-md shadow-2xl">
                    <h3 className="text-lg font-bold mb-4 text-gray-300">HOW TO PLAY</h3>
                    <ul className="text-left text-gray-400 space-y-2 text-sm mb-6 font-sans">
                        <li className="flex items-start gap-2">
                            <span className="text-cyan-500">1.</span> 
                            <span>Wave your hands! Tracking dots should appear.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-cyan-500">2.</span> 
                            <span><strong className="text-cyan-400">Left Hand</strong> moves Left Paddle.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-fuchsia-500">3.</span> 
                            <span><strong className="text-fuchsia-400">Right Hand</strong> moves Right Paddle.</span>
                        </li>
                    </ul>
                    
                    <button 
                        onClick={startGame}
                        className="w-full py-3 px-6 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded uppercase tracking-widest transition-all transform hover:scale-105 shadow-[0_0_20px_rgba(6,182,212,0.5)] cursor-pointer z-50 pointer-events-auto"
                    >
                        Initialise Arena
                    </button>
                </div>
                
                {!apiKeyAvailable && (
                   <p className="text-red-500 text-xs mt-2">Warning: API_KEY not detected. Commentary disabled.</p>
                )}
            </div>
        )}

        {/* AI Commentary Overlay */}
        {gameState === GameState.PLAYING && commentary && (
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 w-[90%] md:w-[70%] z-40">
                <div className="bg-black/60 backdrop-blur-md border border-cyan-500/30 p-4 rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.1)] flex items-start gap-4 transition-all duration-500 animate-fade-in-up">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-300 flex items-center justify-center shrink-0 shadow-lg">
                         <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                    </div>
                    <div>
                        <div className="text-xs text-cyan-400 font-bold mb-1 flex items-center gap-2">
                            GEMINI-X COMMENTARY
                            <span className="inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                        </div>
                        <p className="text-sm md:text-base text-white font-light italic">
                            "{commentary.text}"
                        </p>
                    </div>
                </div>
            </div>
        )}
      </main>
    </div>
  );
};

export default App;
