/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Camera, 
  Settings, 
  Grid3X3, 
  Target, 
  Sun, 
  Focus, 
  Thermometer, 
  RotateCcw,
  Sparkles,
  Info,
  ChevronRight,
  Maximize,
  Download,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

type Mode = 'PHOTO' | 'PORTRAIT' | 'PRO';

export default function App() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [mode, setMode] = useState<Mode>('PHOTO');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [showGrid, setShowGrid] = useState(false);
  const [autoAssist, setAutoAssist] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [poseIndex, setPoseIndex] = useState(0);
  
  const poses = [
    { name: "Neutral", shape: "rounded-[40%]" },
    { name: "Fashion Lean", shape: "rounded-[30%_70%_70%_30%]" },
    { name: "Sitting", shape: "rounded-[20%_20%_80%_80%]" },
    { name: "Profile", shape: "rounded-[70%_30%_30%_70%]" },
    { name: "Close Up", shape: "rounded-[50%]" },
  ];
  
  // Manual Controls
  const [exposure, setExposure] = useState(0);
  const [wb, setWb] = useState(0); // -100 to 100
  const [focus, setFocus] = useState(0); // 0 to 100
  const [iso, setIso] = useState(1); // 1 to 5
  
  // AI State
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<{ 
    objects: string[], 
    tips: string[], 
    pose?: string 
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize Camera
  useEffect(() => {
    async function startCamera() {
      // Stop old tracks first
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      
      try {
        const res = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: facingMode,
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          } 
        });
        setStream(res);
        if (videoRef.current) {
          videoRef.current.srcObject = res;
        }
      } catch (err) {
        console.error("Camera access denied", err);
      }
    }
    startCamera();
    return () => stream?.getTracks().forEach(t => t.stop());
  }, [facingMode]);

  // Handle Auto-Assist
  useEffect(() => {
    let interval: any;
    if (autoAssist && !aiAnalyzing) {
      interval = setInterval(() => {
        analyzeScene();
      }, 10000); // Analyze every 10 seconds if auto-assist is on
    }
    return () => clearInterval(interval);
  }, [autoAssist, aiAnalyzing]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsCapturing(true);
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // Apply manual adjustments to canvas if needed, or rely on CSS filters applied to video
      // Here we just grab the frame
      ctx.drawImage(video, 0, 0);
      setCapturedImage(canvas.toDataURL('image/jpeg'));
    }
    
    setTimeout(() => setIsCapturing(false), 300);
  }, []);

  const analyzeScene = async () => {
    if (!videoRef.current || !canvasRef.current || aiAnalyzing) return;
    setAiAnalyzing(true);
    
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.drawImage(video, 0, 0);
      const base64Image = canvas.toDataURL('image/jpeg').split(',')[1];

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              { text: "Analyze this camera view. Identify main objects and provide 3 short, professional photography tips for composition and 1 specific artistic pose suggestion for the subject if it's a person. Return JSON: { \"objects\": [], \"tips\": [], \"pose\": \"\" }" },
              { inlineData: { mimeType: "image/jpeg", data: base64Image } }
            ]
          }
        ],
        config: { responseMimeType: "application/json" }
      });

      const data = JSON.parse(response.text || '{}');
      setAiFeedback(data);
    } catch (err) {
      console.error("AI Analysis failed", err);
    } finally {
      setAiAnalyzing(false);
    }
  };

  // Dynamically calculate filters based on manual controls
  const cameraFilters = `
    brightness(${1 + exposure / 100})
    contrast(${1 + Math.abs(exposure) / 200})
    hue-rotate(${wb * 0.5}deg)
    saturate(${1 + iso / 10})
  `;

  return (
    <div className="fixed inset-0 bg-bg flex flex-col font-sans text-text-dim selection:bg-accent/30">
      {/* Top Bar - Recalibrated for Prof. Polish */}
      <div className="h-14 flex items-center justify-between px-8 bg-black z-30 font-mono text-[12px] border-b border-ui-border">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-white font-bold tracking-tight">4K 60FPS</span>
          </div>
          <span className="opacity-50">RAW+JPG</span>
        </div>
        
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
             <span className="opacity-50">STABILIZATION: ON</span>
             <div className="w-8 h-4 border border-white/30 p-[1px] relative">
               <div className="h-full bg-emerald-500 w-[85%]" />
             </div>
             <span className="text-white">85%</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setShowGrid(!showGrid)} className={`p-1.5 transition-colors ${showGrid ? 'text-accent' : 'hover:text-white'}`}>
              <Grid3X3 size={18} />
            </button>
            <button className="p-1.5 hover:text-white transition-colors">
              <Settings size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Viewfinder Section */}
      <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center p-3">
        <div className="relative w-full h-full rounded-sm overflow-hidden border-[12px] border-[#1a1a1a] shadow-inner">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted
            className="w-full h-full object-cover transition-all"
            style={{ 
              filter: cameraFilters,
              WebkitFilter: cameraFilters,
            }}
          />

          {/* Side Panel Overlay (Theme Design) */}
          <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-40">
            <ControlCard label="ISO" value={(iso * 100).toString()} />
            <ControlCard label="EV" value={exposure > 0 ? `+${exposure/100}` : (exposure/100).toString()} active={exposure !== 0} />
            <ControlCard label="WB" value={wb >= 0 ? `${5200 + wb*10}K` : `${3200 + wb*10}K`} active={wb !== 0} />
            <ControlCard label="FCS" value={focus === 0 ? "AF" : (focus/10).toFixed(1)} active={focus !== 0} />
          </div>

          {/* Viewfinder Overlays */}
          <AnimatePresence>
            {showGrid && (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                className="absolute inset-0 pointer-events-none"
              >
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                  <div className="border border-white/10 border-l-0 border-t-0" />
                  <div className="border border-white/10 border-l-0 border-t-0" />
                  <div className="border border-white/10 border-r-0 border-t-0" />
                  <div className="border border-white/10 border-l-0" />
                  <div className="border border-white/10 border-l-0" />
                  <div className="border border-white/10 border-r-0" />
                  <div className="border border-white/10 border-l-0 border-b-0" />
                  <div className="border border-white/10 border-l-0 border-b-0" />
                  <div className="border-t border-white/10" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* AI Detection Box Overlay */}
          <div className="absolute border-2 border-accent rounded-sm w-1/3 h-1/2 top-1/4 left-1/3 pointer-events-none transition-all">
             <div className="absolute top-0 left-0 bg-accent text-white px-2 py-0.5 text-[8px] uppercase font-bold">Subject: Detected</div>
          </div>

          {/* Pose Ghost Overlay */}
          <AnimatePresence>
            <motion.div 
              key={poseIndex}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 0.2 }}
              className="absolute inset-0 pointer-events-none flex items-center justify-center"
            >
               <div className={`w-1/2 h-2/3 border border-dashed border-white flex flex-col items-center justify-center ${poses[poseIndex].shape} transition-all duration-1000`}>
                  <span className="text-[10px] uppercase font-mono tracking-widest text-center px-4">
                    Pose Guide:<br/>{poses[poseIndex].name}
                  </span>
               </div>
            </motion.div>
          </AnimatePresence>

          {/* Portrait Blur Mock */}
          <div 
            className="absolute inset-0 pointer-events-none transition-all duration-700"
            style={{ 
              backdropFilter: mode === 'PORTRAIT' ? `blur(${focus / 5}px)` : 'none',
              maskImage: mode === 'PORTRAIT' ? 'radial-gradient(circle at center, transparent 30%, black 100%)' : 'none',
              WebkitMaskImage: mode === 'PORTRAIT' ? 'radial-gradient(circle at center, transparent 30%, black 100%)' : 'none'
            }}
          />

          {/* AI Feedback Tooltip */}
          <AnimatePresence>
            {aiFeedback && (
              <motion.div 
                initial={{ x: -100, opacity: 0 }} 
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -100, opacity: 0 }}
                className="absolute top-6 left-6 z-40 max-w-xs"
              >
                <div className="bg-panel border border-ui-border p-4 rounded-lg shadow-2xl backdrop-blur-xl">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 text-white">
                      <Sparkles size={14} className="text-accent" />
                      <span className="text-[10px] font-bold tracking-widest uppercase">Composition Engine</span>
                    </div>
                    <button onClick={() => setAiFeedback(null)} className="text-white/30 hover:text-white">
                      <X size={14} />
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="space-y-1">
                      {aiFeedback.tips.map((tip, i) => (
                        <div key={i} className="flex gap-2 text-[10px] text-white/80 leading-relaxed">
                          <span className="text-accent font-bold">0{i+1}</span>
                          {tip}
                        </div>
                      ))}
                    </div>
                    {aiFeedback.pose && (
                      <div className="pt-2 border-t border-white/5">
                        <span className="text-[8px] text-white/40 uppercase tracking-widest block mb-1">Pose AI</span>
                        <p className="text-[10px] text-white font-medium italic">
                          "{aiFeedback.pose}"
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Capture Flash */}
          <AnimatePresence>
            {isCapturing && (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-white z-50"
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom Interface - Grid 1fr 2fr 1fr */}
      <div className="h-40 bg-[#111] border-t border-ui-border grid grid-cols-[1fr,2fr,1fr] items-center px-10 gap-8 z-30">
        {/* Left: Blur Slider Area */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[10px] font-bold text-text-dim uppercase tracking-wider">
            <span>Aperture Blur</span>
            <span className="text-white italic">f/1.8</span>
          </div>
          <div className="relative group flex items-center">
            <input 
              type="range" 
              min={0} 
              max={100} 
              value={focus} 
              onChange={(e) => setFocus(Number(e.target.value))}
              className="w-full h-1 bg-[#333] appearance-none rounded-full accent-accent cursor-pointer"
            />
            {/* Custom thumb look is limited in standard range input without heavy CSS, so using standard accent-accent */}
          </div>
        </div>

        {/* Center: Modes + Shutter */}
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-10 text-[11px] font-bold tracking-[0.15em] uppercase">
            {(['PHOTO', 'PORTRAIT', 'PRO'] as Mode[]).map(m => (
              <button 
                key={m}
                onClick={() => setMode(m)}
                className={`relative transition-all pt-2 ${mode === m ? 'text-white' : 'text-text-dim hover:text-white pb-2'}`}
              >
                {m}
                {mode === m && (
                  <motion.div layoutId="modeDot" className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-accent" />
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-12">
            <button 
              onClick={() => setAutoAssist(!autoAssist)}
              className={`p-4 rounded-full border transition-all ${autoAssist ? 'border-accent bg-accent/10' : 'border-white/10 hover:border-accent'}`}
            >
              <Target size={24} className={autoAssist ? 'text-accent' : 'text-white'} />
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 min-w-max">
                <span className="text-[8px] uppercase tracking-widest text-white/50">{autoAssist ? 'Auto-ON' : 'Manual'}</span>
              </div>
            </button>

            <button 
              onClick={capturePhoto}
              className="w-24 h-24 rounded-full border-[6px] border-white p-1.5 hover:scale-105 active:scale-95 transition-all group"
            >
              <div className="w-full h-full rounded-full bg-white group-hover:bg-white/90 transition-colors" />
            </button>

            <button 
              onClick={toggleCamera}
              className="p-4 rounded-full border border-white/10 hover:border-white transition-colors"
            >
              <RotateCcw size={24} className={facingMode === 'user' ? 'rotate-180' : ''} />
            </button>
          </div>
        </div>

        {/* Right: Info Area */}
        <div className="text-right space-y-1">
          <button 
            onClick={() => setPoseIndex((poseIndex + 1) % poses.length)}
            className="text-right group"
          >
            <span className="text-[10px] text-text-dim font-bold uppercase tracking-widest block group-hover:text-accent transition-colors">Switch Pose Guide</span>
            <p className="text-[12px] text-white leading-tight font-mono group-hover:underline">
              {poses[poseIndex].name} Assist
            </p>
          </button>
        </div>
      </div>

      {/* Gallery Modal / Captured Preview */}
      <AnimatePresence>
        {capturedImage && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col p-6 overflow-hidden"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-white text-sm font-bold tracking-widest">MASTER_SHOT_X_2026.JPG</h3>
              <button 
                onClick={() => setCapturedImage(null)}
                className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors text-white"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 relative rounded-2xl overflow-hidden bg-[#151619] flex items-center justify-center">
              <img src={capturedImage} className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
              
              <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end">
                <div className="space-y-1">
                  <span className="text-[9px] text-white/40 block">EXIF DATA</span>
                  <div className="px-3 py-1.5 bg-black/50 backdrop-blur rounded-lg border border-white/10 text-[10px] text-white/80 space-x-4">
                    <span>ISO {iso * 100}</span>
                    <span>1/125s</span>
                    <span>f/1.8</span>
                    <span>{wb > 0 ? '5500K' : '3200K'}</span>
                  </div>
                </div>
                
                <a 
                  href={capturedImage} 
                  download="lumix-pro-shot.jpg"
                  className="p-4 bg-white text-black rounded-full hover:scale-110 transition-transform shadow-xl"
                >
                  <Download size={24} />
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

function ControlCard({ label, value, active }: { label: string, value: string, active?: boolean }) {
  return (
    <div className="bg-panel p-3 border border-ui-border rounded-xl w-[70px] flex flex-col items-center gap-1 backdrop-blur-md">
       <span className="text-[8px] text-text-dim uppercase font-bold tracking-tighter">{label}</span>
       <span className={`text-[13px] font-mono font-bold leading-none ${active ? 'text-accent' : 'text-white'}`}>
         {value}
       </span>
    </div>
  );
}

function ControlSlider({ label, value, onChange, min, max, icon }: { 
  label: string, 
  value: number, 
  onChange: (v: number) => void, 
  min: number, 
  max: number,
  icon: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-[10px] font-bold text-white tracking-widest">{label}</span>
        </div>
        <span className="text-[10px] text-white/40">{value > 0 ? `+${value}` : value}</span>
      </div>
      <div className="relative h-12 flex items-center group">
        <input 
          type="range" 
          min={min} 
          max={max} 
          value={value} 
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full accent-white appearance-none bg-[#1A1B1E] h-1 rounded-full cursor-pointer hover:bg-[#2A2B2E] transition-colors"
        />
        {/* Decorative markers */}
        <div className="absolute inset-0 pointer-events-none flex justify-between px-1 items-end pb-1.5 opacity-20">
          {Array.from({length: 11}).map((_, i) => (
            <div key={i} className={`w-[1px] bg-white ${i % 5 === 0 ? 'h-2' : 'h-1'}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
