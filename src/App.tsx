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
  X,
  Zap,
  ZapOff,
  MapPin,
  Clock,
  History,
  Palette,
  Compass,
  Home,
  Monitor
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";

// Safe lookup for API key to prevent crashes in different environments (Vite vs Node)
const getGeminiKey = () => {
  try {
    // Cast to any to avoid TS errors in environments without vite-client types
    const metaEnv = (import.meta as any).env;
    const key = (metaEnv?.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : '')) as string;
    return key || '';
  } catch {
    return '';
  }
};

const ai = new GoogleGenAI({ apiKey: getGeminiKey() });

type Mode = 'PHOTO' | 'PORTRAIT' | 'PRO';

interface FilterPreset {
  id: string;
  name: string;
  css: string;
  icon: string;
}

const FILTER_PRESETS: FilterPreset[] = [
  { id: 'standard', name: 'Standard', css: '', icon: 'Standard' },
  { id: 'vivid', name: 'Vivid', css: 'saturate(1.5) contrast(1.1) brightness(1.05)', icon: 'Vibrant' },
  { id: 'fresh', name: 'Fresh', css: 'brightness(1.1) saturate(1.2) hue-rotate(-5deg) contrast(1.05)', icon: 'Clear' },
  { id: 'cinematic', name: 'Cinematic', css: 'contrast(1.2) saturate(0.8) sepia(0.2) hue-rotate(5deg)', icon: 'Cinema' },
  { id: 'mono', name: 'Mono', css: 'grayscale(1) contrast(1.3) brightness(1.1)', icon: 'B&W' },
];

// Dot-based pose silhouettes (coordinates from 0-100)
const DOT_POSES = [
  {
    name: "Golden Ratio Stand",
    points: [
      {x: 50, y: 15}, {x: 50, y: 30}, {x: 40, y: 45}, {x: 60, y: 45},
      {x: 35, y: 65}, {x: 65, y: 65}, {x: 50, y: 50}, {x: 45, y: 85}, {x: 55, y: 85}
    ]
  },
  {
    name: "Classic S-Curve",
    points: [
      {x: 55, y: 12}, {x: 50, y: 28}, {x: 45, y: 44}, {x: 50, y: 60},
      {x: 55, y: 76}, {x: 45, y: 92}, {x: 40, y: 35}, {x: 65, y: 40}
    ]
  },
  {
    name: "Fashion Lean",
    points: [
      {x: 40, y: 10}, {x: 42, y: 25}, {x: 45, y: 45}, {x: 50, y: 70},
      {x: 55, y: 90}, {x: 65, y: 30}, {x: 70, y: 55}, {x: 30, y: 50}
    ]
  }
];

function DotSilhouette({ poseIndex }: { poseIndex: number }) {
  const pose = DOT_POSES[poseIndex] || DOT_POSES[0];
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.6 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 pointer-events-none z-30"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {pose.points.map((p, i) => (
          <motion.circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="0.8"
            fill="#FF4D00"
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.5, 1] }}
            transition={{ delay: i * 0.05 }}
          />
        ))}
        {/* Connecting Lines for "Skeleton" look */}
        <polyline
          points={pose.points.map(p => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="#FF4D00"
          strokeWidth="0.1"
          strokeDasharray="1 1"
          opacity="0.3"
        />
      </svg>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-[150px] bg-accent/20 backdrop-blur-md px-3 py-1 rounded-full border border-accent/40">
        <span className="text-[10px] text-accent font-bold uppercase tracking-widest">{pose.name}</span>
      </div>
    </motion.div>
  );
}

export default function App() {
  const [hasStarted, setHasStarted] = useState(false);
  const [showPoseDots, setShowPoseDots] = useState(false);
  const [recommendedPoseIdx, setRecommendedPoseIdx] = useState<number | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [mode, setMode] = useState<Mode>('PHOTO');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [showGrid, setShowGrid] = useState(false);
  const [autoAssist, setAutoAssist] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [poseIndex, setPoseIndex] = useState(0);
  const [torchOn, setTorchOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  
  // Timemark State
  const [timemarkEnabled, setTimemarkEnabled] = useState(false);
  const [timemarkManualText, setTimemarkManualText] = useState("");
  const [useManualDate, setUseManualDate] = useState(false);
  const [manualDateValue, setManualDateValue] = useState(new Date().toISOString().split('T')[0]);
  const [locationText, setLocationText] = useState("Pro Sensor Active");
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleString());
  const [showSettings, setShowSettings] = useState(false);
  const [focusPoint, setFocusPoint] = useState({ x: 50, y: 50 }); // Percentage
  const [showFocusRing, setShowFocusRing] = useState(false);
  
  // Tilt/Level State
  const [tilt, setTilt] = useState({ roll: 0, pitch: 0 });
  const [showLevel, setShowLevel] = useState(true);

  // Filter State
  const [activeFilter, setActiveFilter] = useState<FilterPreset>(FILTER_PRESETS[0]);
  const [showFilters, setShowFilters] = useState(false);

  const handleViewfinderTap = (e: React.MouseEvent | React.TouchEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    
    setFocusPoint({ x, y });
    setShowFocusRing(true);
    setTimeout(() => setShowFocusRing(false), 800);
  };

  // Device Orientation for Level Meter
  useEffect(() => {
    if (typeof window === 'undefined' || !window.DeviceOrientationEvent) return;
    
    // Check for iOS 13+ permission requirement
    const requestPermission = async () => {
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        try {
          await (DeviceOrientationEvent as any).requestPermission();
        } catch (e) {
          console.warn("Orientation permission denied:", e);
        }
      }
    };

    window.addEventListener('deviceorientation', (e) => {
      // Gamma is left-to-right tilt (roll)
      // Beta is front-to-back tilt (pitch)
      if (e.gamma !== null && e.beta !== null) {
        setTilt({ roll: Math.round(e.gamma), pitch: Math.round(e.beta) });
      }
    });

    return () => {
      window.removeEventListener('deviceorientation', () => {});
    };
  }, []);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Geolocation Logic
  const fetchLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          // Add User-Agent as required by Nominatim usage policy if possible, but browser fetch is fine for simple demo
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await res.json();
          // Extract more readable address
          const city = data.address.city || data.address.town || data.address.village || "";
          const county = data.address.county || "";
          const addr = city ? `${city}, ${county}` : `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          setLocationText(addr);
        } catch {
          setLocationText(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        }
      },
      () => setLocationText("GPS Access Denied")
    );
  }, []);

  useEffect(() => {
    if (timemarkEnabled) {
      fetchLocation();
    }
  }, [timemarkEnabled, fetchLocation]);
  
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
  const startCamera = useCallback(async () => {
    if (!hasStarted) return;
    setIsInitializing(true);
    setCameraError(null);
    console.log("System: Starting camera sequence...", facingMode);
    
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("NOT_SUPPORTED");
      }

      // 1. Cleanup existing stream
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }

      // 2. Constraints for High Resolution (4K Ideal)
      const constraints: MediaStreamConstraints = { 
        video: { 
          facingMode: { ideal: facingMode }, 
          width: { ideal: 3840, min: 1280 },
          height: { ideal: 2160, min: 720 },
          frameRate: { ideal: 60 }
        },
        audio: false
      };
      
      const res = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(res);
      
      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = res;
        
        video.setAttribute('playsinline', '');
        video.setAttribute('muted', '');
        video.muted = true;
        
        setTimeout(() => {
          video.play().catch(e => {
            console.warn("Auto-play prevented by browser policy", e);
          });
        }, 50);
      }
    } catch (err: any) {
      console.warn("Camera init failed, trying fallback:", err);
      try {
        const fallbackRes = await navigator.mediaDevices.getUserMedia({ video: true });
        setStream(fallbackRes);
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackRes;
          videoRef.current.play().catch(e => console.error("Final play failure", e));
        }
      } catch (fallbackErr: any) {
        let msg = "Kamera Gagal Dimuat.";
        if (fallbackErr.name === 'NotAllowedError') msg = "Izin Ditolak. Silakan aktifkan izin kamera di pengaturan browser.";
        else if (fallbackErr.name === 'NotFoundError') msg = "Hardware kamera tidak terdeteksi.";
        else if (window.location.protocol !== 'https:') msg = "Akses kamera membutuhkan koneksi HTTPS aman.";
        
        setCameraError(`${msg} (${fallbackErr.name})`);
      }
    } finally {
      setIsInitializing(false);
    }
  }, [facingMode, hasStarted]);

  useEffect(() => {
    if (hasStarted) {
      startCamera();
    }
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [facingMode, hasStarted]);

  // Handle Torch
  useEffect(() => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (track && 'applyConstraints' in track) {
      const capabilities = track.getCapabilities() as any;
      if (capabilities.torch) {
        track.applyConstraints({
          advanced: [{ torch: torchOn } as any]
        }).catch(err => console.error("Torch error:", err));
      }
    }
  }, [torchOn, stream]);

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
      // Selective Blur Logic
      const blurVal = focus > 0 ? focus / 4 : 0; 
      const baseFilters = `brightness(${1 + exposure / 100}) contrast(${1 + Math.abs(exposure) / 200}) hue-rotate(${wb * 0.5}deg) saturate(${1 + iso / 10}) ${activeFilter.css}`;
      const sharpFilters = baseFilters;
      const blurredFilters = `${sharpFilters} blur(${blurVal}px)`;
      
      if (blurVal > 0) {
        // 1. Draw blurred version everywhere
        ctx.filter = blurredFilters;
        ctx.drawImage(video, 0, 0);
        
        // 2. Overlay sharp subject using a soft radial clipping
        ctx.save();
        const fX = (focusPoint.x / 100) * video.videoWidth;
        const fY = (focusPoint.y / 100) * video.videoHeight;
        const radius = Math.min(video.videoWidth, video.videoHeight) * 0.2;
        
        ctx.beginPath();
        ctx.arc(fX, fY, radius, 0, Math.PI * 2);
        ctx.clip();
        
        ctx.filter = sharpFilters;
        ctx.drawImage(video, 0, 0);
        ctx.restore();
      } else {
        // Standard draw no blur
        ctx.filter = sharpFilters;
        ctx.drawImage(video, 0, 0);
      }
      
      // Reset filter for Timemark text overlay
      ctx.filter = 'none';
      
      // Burn-in Timemark if enabled
      if (timemarkEnabled) {
        ctx.font = 'bold 32px "JetBrains Mono", monospace';
        ctx.fillStyle = 'white';
        ctx.shadowBlur = 6;
        ctx.shadowColor = 'black';
        ctx.textAlign = 'left';
        
        // Formatting Indonesian Date
        const daysIndo = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
        const d = useManualDate ? new Date(manualDateValue) : new Date();
        const formattedDate = `${daysIndo[d.getDay()]}, ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
        const timestamp = formattedDate + (useManualDate ? "" : ` • ${new Date().toLocaleTimeString()}`);
        
        const address = timemarkManualText ? `${timemarkManualText} • ${locationText}` : locationText;
        
        ctx.fillText(timestamp, 40, video.videoHeight - 100);
        ctx.font = '24px "JetBrains Mono", monospace';
        ctx.fillText(address, 40, video.videoHeight - 60);
      }

      setCapturedImage(canvas.toDataURL('image/jpeg', 0.95)); // High Quality
    }
    
    setTimeout(() => setIsCapturing(false), 300);
  }, [timemarkEnabled, timemarkManualText, locationText, useManualDate, manualDateValue, exposure, wb, iso, focus, focusPoint, activeFilter]);

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
              { text: `Analyze this camera view. Identify main objects and provide professional photography tips.
                       CRITICAL: If a person is the subject and their pose or position is sub-optimal for the current background/composition:
                       1. Set "pose_score" (1-10) where < 7 means a better pose is needed.
                       2. Set "recommended_pose_id" to 0 (Standing), 1 (S-Curve), or 2 (Fashion Lean) based on what fits the scene best.
                       
                       Return JSON strictly: { 
                         "objects": [], 
                         "tips": [], 
                         "pose": "string description",
                         "pose_score": number,
                         "recommended_pose_id": number | null
                       }` },
              { inlineData: { mimeType: "image/jpeg", data: base64Image } }
            ]
          }
        ],
        config: { responseMimeType: "application/json" }
      });

      const data = JSON.parse(response.text || '{}');
      setAiFeedback(data);
      
      // Automatically show recommended dots if pose score is low and feature is enabled
      if (showPoseDots && data.pose_score < 8 && data.recommended_pose_id !== null) {
        setRecommendedPoseIdx(data.recommended_pose_id);
      } else {
        setRecommendedPoseIdx(null);
      }
    } catch (err) {
      console.error("AI Analysis failed", err);
    } finally {
      setAiAnalyzing(false);
    }
  };

  // Dynamically calculate filters based on manual controls + Selection
  const cameraFilters = `
    brightness(${1 + exposure / 100})
    contrast(${1 + Math.abs(exposure) / 200})
    hue-rotate(${wb * 0.5}deg)
    saturate(${1 + iso / 10})
    ${activeFilter.css}
  `;

  if (!hasStarted) {
    return (
      <div className="fixed inset-0 bg-bg flex items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-8">
          <div className="space-y-4">
            <div className="inline-flex p-4 bg-accent/5 rounded-full border border-accent/20 mb-4 scale-110">
              <Camera size={48} className="text-accent" />
            </div>
            <h1 className="text-4xl font-bold text-white tracking-tighter uppercase italic leading-none">Lumix Pro Camera</h1>
            <p className="text-text-dim text-sm px-4 leading-relaxed">
              Selamat datang di aplikasi kamera profesional. <br/>
              Aplikasi memerlukan izin akses kamera untuk berfungsi sebagai alat bidik presisi tinggi.
            </p>
          </div>
          
          <div className="pt-6">
            <button 
              onClick={async () => {
                // Request orientation permission for iOS
                if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
                  try {
                    await (DeviceOrientationEvent as any).requestPermission();
                  } catch (e) {
                    console.warn("Sensor permission error:", e);
                  }
                }
                setHasStarted(true);
              }}
              className="group relative inline-flex items-center gap-3 px-12 py-5 bg-accent text-white rounded-full font-bold uppercase tracking-widest text-[11px] hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-accent/40"
            >
              <span>Mulai Fotografi</span>
              <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </button>
            <p className="mt-8 text-[10px] text-text-dim font-mono tracking-widest opacity-30">
              OPTIMIZED FOR MOBILE HP • VER 2.1.0
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-bg flex flex-col font-sans text-text-dim selection:bg-accent/30">
      {/* Top Bar - Recalibrated for Prof. Polish */}
      <div className="h-14 flex items-center justify-between px-8 bg-black z-30 font-mono text-[12px] border-b border-ui-border">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-white font-bold tracking-tight">4K ULTRA HD</span>
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
            <button 
              onClick={() => {
                if (document.fullscreenElement) {
                  document.exitFullscreen();
                } else {
                  document.documentElement.requestFullscreen();
                }
              }}
              className="p-1.5 hover:text-white transition-colors" 
              title="Fullscreen"
            >
              <Maximize size={18} />
            </button>
            <button 
              onClick={() => {
                setHasStarted(false);
                if (stream) stream.getTracks().forEach(t => t.stop());
                setStream(null);
              }}
              className="p-1.5 hover:text-white transition-colors" 
              title="Home"
            >
              <Home size={18} />
            </button>
            <button onClick={() => setShowGrid(!showGrid)} className={`p-1.5 transition-colors ${showGrid ? 'text-accent' : 'hover:text-white'}`}>
              <Grid3X3 size={18} />
            </button>
            <button className="p-1.5 hover:text-white transition-colors" onClick={() => setShowSettings(!showSettings)}>
              <Settings size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Settings Modal (Timemark Configuration) */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute top-16 right-8 w-64 bg-panel border border-ui-border rounded-2xl p-4 z-[60] backdrop-blur-2xl shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white">Settings</span>
              <button onClick={() => setShowSettings(false)} className="text-white/30 hover:text-white"><X size={14} /></button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-tighter">Enable Timemark</span>
                <button 
                  onClick={() => setTimemarkEnabled(!timemarkEnabled)}
                  className={`w-10 h-5 rounded-full relative transition-colors ${timemarkEnabled ? 'bg-accent' : 'bg-white/10'}`}
                >
                  <div className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-transform ${timemarkEnabled ? 'translate-x-5' : ''}`} />
                </button>
              </div>
              
              {timemarkEnabled && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-1">
                   {/* Timemark Settings (existing) */}
                   <div className="space-y-3">
                     <label className="text-[8px] uppercase text-text-dim block">Annotation Details</label>
                     <input 
                      type="text" 
                      placeholder="Custom label (e.g. Project Name)"
                      value={timemarkManualText}
                      onChange={(e) => setTimemarkManualText(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white focus:outline-none focus:border-accent transition-colors"
                     />
                     
                     {/* Manual Date Toggle */}
                     <div className="flex items-center justify-between py-2 border-t border-white/5">
                        <span className="text-[9px] text-white/60">Use Manual Date</span>
                        <button 
                          onClick={() => setUseManualDate(!useManualDate)}
                          className={`w-8 h-4 rounded-full relative transition-colors ${useManualDate ? 'bg-accent' : 'bg-white/10'}`}
                        >
                          <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${useManualDate ? 'translate-x-4' : ''}`} />
                        </button>
                     </div>

                     {useManualDate && (
                        <input 
                          type="date"
                          value={manualDateValue}
                          onChange={(e) => setManualDateValue(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white focus:outline-none focus:border-accent"
                        />
                     )}

                     <div className="flex items-center gap-2 text-[8px] text-text-dim pt-1">
                       <MapPin size={8} />
                       <span className="truncate">{locationText}</span>
                     </div>
                   </div>

                   {/* AI Pose Dots Toggle */}
                   <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                     <div className="flex flex-col">
                       <span className="text-[10px] uppercase font-bold tracking-tighter">AI Pose Dots</span>
                       <span className="text-[8px] text-text-dim">Show recommended pose points</span>
                     </div>
                     <button 
                       onClick={() => setShowPoseDots(!showPoseDots)}
                       className={`w-10 h-5 rounded-full relative transition-colors ${showPoseDots ? 'bg-accent' : 'bg-white/10'}`}
                     >
                       <div className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-transform ${showPoseDots ? 'translate-x-5' : ''}`} />
                     </button>
                   </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Viewfinder Section */}
      <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center p-2 sm:p-3">
        <div 
          onClick={handleViewfinderTap}
          className="relative w-full h-full rounded-sm overflow-hidden border-[1px] md:border-[12px] border-[#1a1a1a] shadow-inner flex items-center justify-center bg-neutral-900 cursor-crosshair"
        >
          {/* Tap-to-Focus Ring */}
          <AnimatePresence>
            {showFocusRing && (
              <motion.div 
                initial={{ scale: 2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ left: `${focusPoint.x}%`, top: `${focusPoint.y}%` }}
                className="absolute w-16 h-16 border-2 border-accent rounded-full -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none"
              >
                <div className="absolute inset-0 border border-accent/30 rounded-full animate-ping" />
              </motion.div>
            )}
          </AnimatePresence>
          {cameraError ? (
            <div className="text-center p-8 space-y-4 z-50">
              <Camera size={48} className="mx-auto text-accent mb-4 opacity-50" />
              <p className="text-white text-sm font-bold uppercase tracking-widest">Camera Error</p>
              <p className="text-text-dim text-xs max-w-xs leading-relaxed">{cameraError}</p>
              <button 
                onClick={() => window.location.reload()}
                className="mt-4 px-6 py-2 bg-accent text-white text-[10px] font-bold uppercase tracking-tighter hover:scale-105 transition-transform"
              >
                Retry Connection
              </button>
            </div>
          ) : !stream ? (
            <div className="flex flex-col items-center gap-6 z-50">
              <div className="w-16 h-16 rounded-full border-2 border-accent border-t-transparent animate-spin" />
              <div className="flex flex-col items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest text-accent font-bold">Initializing Sensor...</span>
                <p className="text-[9px] text-text-dim text-center px-8">Jika kamera tidak muncul, klik tombol di bawah untuk meminta izin ulang.</p>
              </div>
              <button 
                onClick={startCamera}
                className="px-6 py-2 bg-white text-black text-[10px] font-bold uppercase tracking-tighter hover:bg-white/90"
              >
                Aktifkan Kamera
              </button>
            </div>
          ) : (
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
          )}

          {/* Side Panel Overlay (Theme Design) */}
          <div className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-40 max-h-[85vh] overflow-y-auto overflow-x-hidden no-scrollbar py-4 px-1 pr-2">
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`bg-panel p-2 border border-ui-border rounded-xl w-[64px] shrink-0 flex flex-col items-center gap-1 backdrop-blur-md transition-colors ${showFilters ? 'border-accent' : ''}`}
            >
              <span className="text-[7px] text-text-dim uppercase font-bold tracking-tighter">Filter</span>
              <Palette size={14} className={showFilters ? "text-accent" : "text-white/20"} />
            </button>
            <button 
              onClick={() => setShowLevel(!showLevel)}
              className={`bg-panel p-2 border border-ui-border rounded-xl w-[64px] shrink-0 flex flex-col items-center gap-1 backdrop-blur-md transition-colors ${showLevel && Math.abs(tilt.roll) < 2 ? 'border-accent' : ''}`}
            >
              <span className="text-[7px] text-text-dim uppercase font-bold tracking-tighter">Level</span>
              <Compass size={14} className={showLevel ? "text-accent" : "text-white/20"} />
            </button>
            <button 
              onClick={() => setTorchOn(!torchOn)}
              className={`bg-panel p-2 border border-ui-border rounded-xl w-[64px] shrink-0 flex flex-col items-center gap-1 backdrop-blur-md transition-colors ${torchOn ? 'border-accent' : ''}`}
            >
              <span className="text-[7px] text-text-dim uppercase font-bold tracking-tighter">Flash</span>
              {torchOn ? <Zap size={14} className="text-accent" /> : <ZapOff size={14} className="text-white/20" />}
            </button>
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

          {/* Horizon / Level Meter */}
          {showLevel && (
            <div className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center">
               <motion.div 
                 animate={{ rotate: tilt.roll }}
                 className={`w-48 h-[1px] relative flex items-center justify-center transition-colors duration-300 ${Math.abs(tilt.roll) < 2 ? 'bg-accent' : 'bg-white/30'}`}
               >
                 <div className={`absolute -top-1.5 w-1.5 h-3 border-l ${Math.abs(tilt.roll) < 2 ? 'border-accent' : 'border-white/30'}`} />
                 <div className="absolute -left-4 text-[8px] font-mono text-white/50">{tilt.roll}°</div>
               </motion.div>
            </div>
          )}

          {/* Filter Selection Panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div 
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
                className="absolute right-24 top-1/2 -translate-y-1/2 z-50 bg-panel border border-ui-border rounded-2xl p-2 flex flex-col gap-2 backdrop-blur-xl"
              >
                {FILTER_PRESETS.map((f) => (
                  <button 
                    key={f.id}
                    onClick={() => { setActiveFilter(f); setShowFilters(false); }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:bg-white/5 ${activeFilter.id === f.id ? 'bg-accent/10 border border-accent/30' : 'border border-transparent'}`}
                  >
                    <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center bg-gradient-to-br from-white/10 to-transparent">
                       <span className="text-[8px] font-bold text-white/50">{f.icon[0]}</span>
                    </div>
                    <div className="text-left">
                      <p className={`text-[10px] font-bold uppercase tracking-tight ${activeFilter.id === f.id ? 'text-accent' : 'text-white'}`}>{f.name}</p>
                      <p className="text-[8px] text-text-dim">{f.icon}</p>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

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

          {/* Portrait Blur Effect - Now driven by focus slider and tap point */}
          <div 
            className="absolute inset-0 pointer-events-none transition-all duration-700"
            style={{ 
              backdropFilter: focus > 0 ? `blur(${focus / 5}px)` : 'none',
              maskImage: focus > 0 ? `radial-gradient(circle at ${focusPoint.x}% ${focusPoint.y}%, transparent 20%, black 60%)` : 'none',
              WebkitMaskImage: focus > 0 ? `radial-gradient(circle at ${focusPoint.x}% ${focusPoint.y}%, transparent 20%, black 60%)` : 'none'
            }}
          />

          {/* Timemark Overlay */}
          <AnimatePresence>
            {timemarkEnabled && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute bottom-6 left-6 z-40 flex flex-col gap-1 pointer-events-none drop-shadow-lg"
              >
                  <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                    <Clock size={12} className="text-accent" />
                    <span className="text-[10px] font-mono font-bold text-white uppercase tracking-widest">
                      {(() => {
                        const daysIndo = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
                        const d = useManualDate ? new Date(manualDateValue) : new Date();
                        const formattedDate = `${daysIndo[d.getDay()]}, ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
                        return useManualDate ? formattedDate : `${formattedDate} • ${new Date().toLocaleTimeString()}`;
                      })()}
                    </span>
                  </div>
                {(locationText || timemarkManualText) && (
                  <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                    <MapPin size={12} className="text-accent" />
                    <span className="text-[10px] font-mono text-white/80 uppercase tracking-tight">
                      {timemarkManualText ? `${timemarkManualText} • ` : ''}{locationText}
                    </span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Captured Preview (Small thumbnail) */}
          {capturedImage && (
            <div className="absolute top-6 left-6 z-40 w-16 h-16 rounded-lg border-2 border-white/20 overflow-hidden shadow-2xl hover:scale-110 transition-transform cursor-pointer" onClick={() => setShowSettings(false)}>
               <img src={capturedImage} className="w-full h-full object-cover" />
            </div>
          )}
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

      {/* Bottom Interface - Responsive Grid */}
      <div className="min-h-[180px] md:h-44 bg-[#111] border-t border-ui-border flex flex-col md:grid md:grid-cols-[1.2fr,2fr,0.8fr] items-center px-6 md:px-10 py-4 gap-4 z-30">
        {/* Left: Blur Slider Area - Optimized for mobile visibility */}
        <div className="w-full space-y-3 max-w-[300px] md:max-w-none">
          <div className="flex items-center justify-between text-[10px] font-bold text-text-dim uppercase tracking-wider">
            <div className="flex items-center gap-2">
              <Sun size={12} className="text-accent" />
              <span>Background Blur</span>
            </div>
            <span className="text-white italic">{focus === 0 ? "OFF" : `f/${(22 - focus/5).toFixed(1)}`}</span>
          </div>
          <div className="relative group flex items-center h-8">
            <input 
              type="range" 
              min={0} 
              max={100} 
              value={focus} 
              onChange={(e) => setFocus(Number(e.target.value))}
              className="w-full h-1.5 bg-[#333] appearance-none rounded-full accent-accent cursor-pointer"
            />
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

          <div className="flex items-center gap-6 md:gap-12">
            <button 
              onClick={() => {
                setShowPoseDots(!showPoseDots);
                if (!showPoseDots) analyzeScene(); // Trigger analysis when enabling
              }}
              className={`p-3 md:p-4 rounded-full border transition-all ${showPoseDots ? 'border-accent bg-accent/20' : 'border-white/10'}`}
              title="AI Pose Recommendation"
            >
              <Info size={20} className={showPoseDots ? 'text-accent' : 'text-white'} />
            </button>

            <button 
              onClick={() => setAutoAssist(!autoAssist)}
              className={`p-3 md:p-4 rounded-full border transition-all ${autoAssist ? 'border-accent bg-accent/10' : 'border-white/10 hover:border-accent'}`}
            >
              <Target size={20} className={autoAssist ? 'text-accent' : 'text-white'} />
            </button>

            <button 
              onClick={capturePhoto}
              className="w-20 h-20 md:w-24 md:h-24 rounded-full border-[4px] md:border-[6px] border-white p-1.5 hover:scale-105 active:scale-95 transition-all group"
            >
              <div className="w-full h-full rounded-full bg-white group-hover:bg-white/90 transition-colors" />
            </button>

            <button 
              onClick={toggleCamera}
              className="p-3 md:p-4 rounded-full border border-white/10 hover:border-white transition-colors"
            >
              <RotateCcw size={20} className={facingMode === 'user' ? 'rotate-180' : ''} />
            </button>
          </div>
        </div>

        {/* Right: Info Area - Stacked on mobile */}
        <div className="flex md:flex-col items-center justify-end w-full gap-4 md:gap-1 text-right">
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
    <div className="bg-panel p-2 border border-ui-border rounded-xl w-[64px] shrink-0 flex flex-col items-center gap-1 backdrop-blur-md">
       <span className="text-[7px] text-text-dim uppercase font-bold tracking-tighter">{label}</span>
       <span className={`text-[12px] font-mono font-bold leading-none ${active ? 'text-accent' : 'text-white'}`}>
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
