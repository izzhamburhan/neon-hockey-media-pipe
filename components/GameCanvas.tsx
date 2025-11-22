
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { VisionService } from '../services/visionService';
import { GameState, PlayerState, BallState, GameCommentary } from '../types';
import { generateCommentary } from '../services/geminiService';

// --- Constants ---
const PADDLE_HEIGHT = 0.2; // 20% of screen height
const PADDLE_WIDTH = 0.02; // 2% of screen width
const BALL_SIZE = 0.025;

// DIFFICULTY SETTINGS
const INITIAL_SPEED = 0.025; // Increased starting speed for immediate challenge
const SPEED_INCREMENT = 0.0025; // Faster ramp-up per hit
const MAX_SPEED = 0.08; // Higher top speed
const MAX_REFLECTION_ANGLE = Math.PI / 3; // 60 degrees - Sharper angles for edge hits

interface GameCanvasProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  onCommentary: (commentary: GameCommentary) => void;
  resetTrigger: number; // Increments to trigger a reset
}

// Helper to track raw hand positions for visualization
interface HandVisual {
  x: number;
  y: number;
  player: 'P1' | 'P2';
}

const GameCanvas: React.FC<GameCanvasProps> = ({ gameState, setGameState, onCommentary, resetTrigger }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Game Logic Refs (Mutable state for high-performance loop)
  const player1Ref = useRef<PlayerState>({ score: 0, y: 0.5, name: 'CYAN', color: '#06b6d4' });
  const player2Ref = useRef<PlayerState>({ score: 0, y: 0.5, name: 'MAGENTA', color: '#d946ef' });
  const ballRef = useRef<BallState>({ x: 0.5, y: 0.5, vx: INITIAL_SPEED, vy: 0.01, speed: INITIAL_SPEED });
  
  // Visualization Refs
  const handsVisualRef = useRef<HandVisual[]>([]);
  const scoreEffectsRef = useRef({ p1: 1, p2: 1 }); // Scale factor for score animation
  
  const requestRef = useRef<number>();
  const lastVideoTimeRef = useRef<number>(-1);
  const scoreTriggeredRef = useRef<boolean>(false);

  // Vision Service
  const [visionLoaded, setVisionLoaded] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);

  // Helper to reset ball with Progressive Difficulty
  const resetBall = (scorer: 'p1' | 'p2') => {
    const totalScore = player1Ref.current.score + player2Ref.current.score;
    
    // Difficulty Ramp: Speed increases slightly with every goal scored
    const difficultyBoost = Math.min(totalScore * 0.0015, 0.02); 
    const startSpeed = INITIAL_SPEED + difficultyBoost;

    ballRef.current = {
      x: 0.5,
      y: 0.5,
      vx: scorer === 'p1' ? startSpeed : -startSpeed, // Loser serves
      vy: (Math.random() - 0.5) * 0.06, // More random initial serving angle
      speed: startSpeed
    };
  };

  // --- Reset Logic ---
  useEffect(() => {
    if (resetTrigger > 0) {
        // Reset Scores
        player1Ref.current.score = 0;
        player2Ref.current.score = 0;
        
        // Reset Animation Effects
        scoreEffectsRef.current = { p1: 1, p2: 1 };

        // Reset Ball (Randomize starter)
        resetBall(Math.random() > 0.5 ? 'p1' : 'p2');
    }
  }, [resetTrigger]);

  // --- Initialization ---
  useEffect(() => {
    const initVision = async () => {
      try {
        await VisionService.getInstance().initialize();
        setVisionLoaded(true);
      } catch (e) {
        console.error("Failed to load vision", e);
      }
    };
    initVision();
  }, []);

  // --- Camera Setup ---
  useEffect(() => {
    const enableCamera = async () => {
      if (!visionLoaded || !videoRef.current) return;
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 1280 }, 
            height: { ideal: 720 }, 
            frameRate: 30 
          } 
        });
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
      } catch (err) {
        console.error("Camera permission denied", err);
      }
    };

    if (gameState !== GameState.LOADING && visionLoaded) {
      enableCamera();
    }

    return () => {
      // Cleanup stream
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, [visionLoaded, gameState]);

  // --- Game Loop ---
  const updateGame = useCallback(() => {
    if (!canvasRef.current) return;

    // 1. Vision Processing - Run in both MENU and PLAYING states so user can test hands
    const shouldDetect = gameState === GameState.PLAYING || gameState === GameState.MENU;
    const vision = VisionService.getInstance();

    if (shouldDetect && videoRef.current && videoRef.current.readyState >= 2) {
       const t = performance.now();
       if (t - lastVideoTimeRef.current >= 30) { // Limit vision processing rate
         lastVideoTimeRef.current = t;
         const results = vision.detect(videoRef.current, t);
         
         handsVisualRef.current = []; // Reset visuals

         if (results && results.landmarks) {
           // Process raw landmarks into simple points
           const hands = results.landmarks.map((landmarks) => {
             const avgX = landmarks.reduce((acc, pt) => acc + pt.x, 0) / landmarks.length;
             const avgY = landmarks.reduce((acc, pt) => acc + pt.y, 0) / landmarks.length;
             // MIRROR MODE: Flip X axis for visual intuition
             return { x: 1 - avgX, y: avgY }; 
           });

           // Assign hands to players based on Visual X position
           hands.forEach(hand => {
               if (hand.x < 0.5) {
                   // Left side -> Player 1
                   player1Ref.current.y = hand.y;
                   handsVisualRef.current.push({ ...hand, player: 'P1' });
               } else {
                   // Right side -> Player 2
                   player2Ref.current.y = hand.y;
                   handsVisualRef.current.push({ ...hand, player: 'P2' });
               }
           });
         }
       }
    }

    // 2. Physics - Only run during PLAYING
    if (gameState === GameState.PLAYING) {
        const ball = ballRef.current;
        const p1 = player1Ref.current;
        const p2 = player2Ref.current;

        ball.x += ball.vx;
        ball.y += ball.vy;

        // Wall Collisions (Top/Bottom)
        if (ball.y <= 0 || ball.y >= 1) {
            ball.vy *= -1;
            ball.y = Math.max(0, Math.min(1, ball.y)); // Clamp
        }

        // Paddle Collisions
        // PADDLE_WIDTH + 0.02 buffer prevents tunneling at high speeds
        
        // Player 1 (Left, x=0)
        if (ball.x <= PADDLE_WIDTH + 0.02 && ball.x >= -0.02 && ball.vx < 0) {
            // Check vertical overlap
            if (Math.abs(ball.y - p1.y) < PADDLE_HEIGHT / 2 + BALL_SIZE) {
                // Calculate normalized intersection point (-1 to 1)
                // -1 = Top of paddle, 0 = Center, 1 = Bottom of paddle
                let intersectY = (ball.y - p1.y) / (PADDLE_HEIGHT / 2);
                intersectY = Math.max(-1, Math.min(1, intersectY)); // Clamp

                // Determine bounce angle
                const bounceAngle = intersectY * MAX_REFLECTION_ANGLE;

                // Increase Speed
                ball.speed = Math.min(ball.speed + SPEED_INCREMENT, MAX_SPEED);

                // Set new velocity based on angle
                // P1 is on left, so ball bounces to the right (Positive Cos)
                ball.vx = ball.speed * Math.cos(bounceAngle);
                ball.vy = ball.speed * Math.sin(bounceAngle);
            }
        }

        // Player 2 (Right, x=1)
        if (ball.x >= 1 - (PADDLE_WIDTH + 0.02) && ball.x <= 1.02 && ball.vx > 0) {
            // Check vertical overlap
            if (Math.abs(ball.y - p2.y) < PADDLE_HEIGHT / 2 + BALL_SIZE) {
                // Calculate normalized intersection point
                let intersectY = (ball.y - p2.y) / (PADDLE_HEIGHT / 2);
                intersectY = Math.max(-1, Math.min(1, intersectY)); // Clamp

                // Determine bounce angle
                const bounceAngle = intersectY * MAX_REFLECTION_ANGLE;

                // Increase Speed
                ball.speed = Math.min(ball.speed + SPEED_INCREMENT, MAX_SPEED);

                // Set new velocity based on angle
                // P2 is on right, so ball bounces to the left (Negative Cos)
                ball.vx = -ball.speed * Math.cos(bounceAngle);
                ball.vy = ball.speed * Math.sin(bounceAngle);
            }
        }

        // Scoring
        if (ball.x < -0.05) { // Allow ball to go slightly off screen before resetting
            // P2 Scores
            p2.score += 1;
            scoreEffectsRef.current.p2 = 2.5; // Pop effect
            resetBall('p2');
            
            // Trigger Gemini
            if (!scoreTriggeredRef.current) {
                scoreTriggeredRef.current = true;
                generateCommentary('score_p2', p1.score, p2.score).then(text => {
                    onCommentary({ text, timestamp: Date.now(), type: 'score' });
                    scoreTriggeredRef.current = false;
                });
            }
        } else if (ball.x > 1.05) {
            // P1 Scores
            p1.score += 1;
            scoreEffectsRef.current.p1 = 2.5; // Pop effect
            resetBall('p1');
            
            // Trigger Gemini
            if (!scoreTriggeredRef.current) {
                scoreTriggeredRef.current = true;
                generateCommentary('score_p1', p1.score, p2.score).then(text => {
                    onCommentary({ text, timestamp: Date.now(), type: 'score' });
                    scoreTriggeredRef.current = false;
                });
            }
        }
    }
  }, [gameState, onCommentary]);

  // --- Rendering ---
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    const time = Date.now();
    
    // Clear Canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw semi-transparent overlay
    // Make it darker in menu mode so text is readable
    const overlayOpacity = gameState === GameState.MENU ? 0.5 : 0.3;
    ctx.fillStyle = `rgba(0, 0, 0, ${overlayOpacity})`; 
    ctx.fillRect(0, 0, width, height);

    // Grid/Table effect
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.stroke();

    // Center Circle
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 50, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.stroke();

    // --- Draw Detected Hands & Connections (Always Draw if Detected) ---
    handsVisualRef.current.forEach(hand => {
        const hX = hand.x * width;
        const hY = hand.y * height;
        const color = hand.player === 'P1' ? player1Ref.current.color : player2Ref.current.color;
        const targetX = hand.player === 'P1' ? 20 : width - 20; // Paddle X position
        const targetY = (hand.player === 'P1' ? player1Ref.current.y : player2Ref.current.y) * height;

        // 1. Connection Line (Hand to Paddle)
        const gradient = ctx.createLinearGradient(hX, hY, targetX, targetY);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.beginPath();
        ctx.moveTo(hX, hY);
        ctx.lineTo(targetX, targetY);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]); // Dashed line
        ctx.stroke();
        ctx.setLineDash([]); // Reset

        // 2. Hand Tracker Ring
        ctx.beginPath();
        ctx.arc(hX, hY, 20, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.shadowColor = color;
        ctx.shadowBlur = 15;
        ctx.stroke();
        
        // Inner Pulse
        const pulse = (Math.sin(time * 0.008) + 1) * 8;
        ctx.beginPath();
        ctx.arc(hX, hY, 15 + pulse, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.5;
        ctx.stroke();
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;

        // 3. Label
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Orbitron';
        ctx.fillText(hand.player === 'P1' ? 'P1 CONTROL' : 'P2 CONTROL', hX - 30, hY - 30);
    });

    // Player 1 Paddle (Left)
    const p1Y = player1Ref.current.y * height;
    const p1H = PADDLE_HEIGHT * height;
    ctx.fillStyle = player1Ref.current.color;
    ctx.shadowColor = player1Ref.current.color;
    ctx.shadowBlur = 20;
    ctx.fillRect(10, p1Y - p1H / 2, 15, p1H);

    // Player 2 Paddle (Right)
    const p2Y = player2Ref.current.y * height;
    const p2H = PADDLE_HEIGHT * height;
    ctx.fillStyle = player2Ref.current.color;
    ctx.shadowColor = player2Ref.current.color;
    ctx.shadowBlur = 20;
    ctx.fillRect(width - 25, p2Y - p2H / 2, 15, p2H);

    // Only draw Ball and Scores if Playing
    if (gameState === GameState.PLAYING) {
        // Ball
        const bX = ballRef.current.x * width;
        const bY = ballRef.current.y * height;
        const bSize = BALL_SIZE * height;
        
        ctx.beginPath();
        ctx.arc(bX, bY, bSize, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 15;
        ctx.fill();
        
        // Motion Blur / Trail for Ball
        if (ballRef.current.speed > 0.03) {
            ctx.beginPath();
            ctx.arc(bX - (ballRef.current.vx * width * 2), bY - (ballRef.current.vy * height * 2), bSize * 0.8, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fill();
        }

        // Reset Shadow
        ctx.shadowBlur = 0;

        // --- Scores with Animation ---
        
        // Decay score effects
        scoreEffectsRef.current.p1 += (1 - scoreEffectsRef.current.p1) * 0.05;
        scoreEffectsRef.current.p2 += (1 - scoreEffectsRef.current.p2) * 0.05;

        ctx.font = 'bold 80px Orbitron';
        ctx.textAlign = 'center';
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 4;
        
        // Draw P1 Score
        ctx.save();
        ctx.translate(width / 4, height / 2 + 30);
        ctx.scale(scoreEffectsRef.current.p1, scoreEffectsRef.current.p1);
        const p1Alpha = 0.5 + Math.max(0, (scoreEffectsRef.current.p1 - 1) * 0.5);
        ctx.fillStyle = `rgba(6, 182, 212, ${Math.min(1, p1Alpha)})`;
        ctx.strokeText(player1Ref.current.score.toString(), 0, 0);
        ctx.fillText(player1Ref.current.score.toString(), 0, 0);
        ctx.restore();

        // Draw P2 Score
        ctx.save();
        ctx.translate((width * 3) / 4, height / 2 + 30);
        ctx.scale(scoreEffectsRef.current.p2, scoreEffectsRef.current.p2);
        const p2Alpha = 0.5 + Math.max(0, (scoreEffectsRef.current.p2 - 1) * 0.5);
        ctx.fillStyle = `rgba(217, 70, 239, ${Math.min(1, p2Alpha)})`;
        ctx.strokeText(player2Ref.current.score.toString(), 0, 0);
        ctx.fillText(player2Ref.current.score.toString(), 0, 0);
        ctx.restore();
    }

  }, [gameState]);

  const tick = useCallback(() => {
    updateGame();
    draw();
    requestRef.current = requestAnimationFrame(tick);
  }, [updateGame, draw]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(tick);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [tick]);

  // Resize handling
  useEffect(() => {
    const handleResize = () => {
        if (containerRef.current && canvasRef.current) {
            canvasRef.current.width = containerRef.current.clientWidth;
            canvasRef.current.height = containerRef.current.clientHeight;
        }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);


  return (
    <div className="relative w-full h-full bg-black rounded-xl overflow-hidden border border-gray-800 shadow-2xl" ref={containerRef}>
        {/* Video is flipped horizontally for mirror effect */}
        <video 
            ref={videoRef} 
            className="absolute inset-0 w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
            playsInline 
            muted 
        />
        
        <canvas 
            ref={canvasRef}
            className="absolute inset-0 w-full h-full z-10"
        />

        {/* Loading State Overlay */}
        {!cameraActive && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/90 text-white z-20">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-t-cyan-500 border-b-magenta-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <p>Initializing Neuro-Link (Camera)...</p>
                </div>
            </div>
        )}
    </div>
  );
};

export default GameCanvas;
