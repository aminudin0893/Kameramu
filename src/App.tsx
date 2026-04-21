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
  RotateCw,
  Sparkles,
  Info,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
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
  Monitor,
  Eye,
  EyeOff
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

const toggleFullscreen = () => {
  const doc = document as any;
  const docEl = document.documentElement as any;

  const requestFullscreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullscreen || docEl.msRequestFullscreen;
  const exitFullscreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;

  if (!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
    if (requestFullscreen) requestFullscreen.call(docEl).catch((e: any) => console.warn("Fullscreen failed:", e));
  } else {
    if (exitFullscreen) exitFullscreen.call(doc);
  }
};

type Mode = 'PHOTO' | 'PORTRAIT' | 'LANDSCAPE' | 'PRO' | 'PAS_PHOTO' | 'FREE_POSE';
type FocusMode = 'FOCUS_SUBJECT' | 'BLUR_SUBJECT';
type PasPhotoSize = '2x3' | '3x4' | '4x6';

interface FilterPreset {
  id: string;
  name: string;
  css: string;
  icon: string;
}

const FILTER_PRESETS: FilterPreset[] = [
  { id: 'standard', name: 'Standard', css: '', icon: 'Standard' },
  { id: 'vibrant', name: 'Vibrant', css: 'saturate(1.4) contrast(1.1) brightness(1.05)', icon: 'Vibrant' },
  { id: 'iphone_vibrant', name: 'iPhone Vibrant', css: 'saturate(1.5) contrast(1.1) brightness(1.02) sepia(0.05)', icon: 'Smart' },
  { id: 'iphone_warm', name: 'iPhone Warm', css: 'sepia(0.15) saturate(1.2) contrast(1.05) brightness(1.02)', icon: 'Warm' },
  { id: 'iphone_cool', name: 'iPhone Cool', css: 'hue-rotate(-5deg) saturate(1.1) contrast(1.05)', icon: 'Cool' },
  { id: 'cinematic', name: 'Cinematic', css: 'contrast(1.2) saturate(0.85) sepia(0.2) hue-rotate(5deg)', icon: 'Cinema' },
  { id: 'noir', name: 'Noir', css: 'grayscale(1) contrast(1.7) brightness(0.85)', icon: 'Deep B&W' },
];

// Dot-based pose silhouettes (coordinates from 0-100)
const DOT_POSES = [
  { name: "Golden Ratio Stand", points: [{x: 50, y: 15}, {x: 50, y: 30}, {x: 40, y: 45}, {x: 60, y: 45}, {x: 35, y: 65}, {x: 65, y: 65}, {x: 50, y: 50}, {x: 45, y: 85}, {x: 55, y: 85}] },
  { name: "Classic S-Curve", points: [{x: 55, y: 12}, {x: 50, y: 28}, {x: 45, y: 44}, {x: 50, y: 60}, {x: 55, y: 76}, {x: 45, y: 92}, {x: 40, y: 35}, {x: 65, y: 40}] },
  { name: "Fashion Lean", points: [{x: 40, y: 10}, {x: 42, y: 25}, {x: 45, y: 45}, {x: 50, y: 70}, {x: 55, y: 90}, {x: 65, y: 30}, {x: 70, y: 55}, {x: 30, y: 50}] },
  { name: "Sultry Look", points: [{x: 52, y: 18}, {x: 48, y: 35}, {x: 55, y: 50}, {x: 45, y: 65}, {x: 50, y: 85}, {x: 30, y: 40}, {x: 70, y: 42}] },
  { name: "Street Walk", points: [{x: 45, y: 15}, {x: 48, y: 32}, {x: 52, y: 50}, {x: 45, y: 70}, {x: 55, y: 90}, {x: 60, y: 40}, {x: 35, y: 45}] },
  { name: "Confident Sit", points: [{x: 50, y: 30}, {x: 50, y: 45}, {x: 40, y: 55}, {x: 60, y: 55}, {x: 35, y: 75}, {x: 65, y: 75}, {x: 45, y: 90}, {x: 55, y: 90}] },
  { name: "Over Shoulder", points: [{x: 60, y: 15}, {x: 55, y: 35}, {x: 45, y: 50}, {x: 50, y: 80}, {x: 35, y: 40}, {x: 25, y: 60}] },
  { name: "Hands on Hips", points: [{x: 50, y: 15}, {x: 50, y: 30}, {x: 30, y: 45}, {x: 70, y: 45}, {x: 50, y: 50}, {x: 45, y: 85}, {x: 55, y: 85}] },
  { name: "Soft Lean", points: [{x: 35, y: 15}, {x: 40, y: 35}, {x: 50, y: 60}, {x: 60, y: 85}, {x: 70, y: 35}] },
  { name: "Dynamic Jump", points: [{x: 50, y: 10}, {x: 55, y: 25}, {x: 40, y: 40}, {x: 70, y: 40}, {x: 30, y: 70}, {x: 80, y: 70}] },
  { name: "Profile Pose", points: [{x: 40, y: 15}, {x: 42, y: 35}, {x: 40, y: 60}, {x: 45, y: 90}, {x: 55, y: 40}] },
  { name: "Hands in Pockets", points: [{x: 50, y: 15}, {x: 50, y: 30}, {x: 42, y: 48}, {x: 58, y: 48}, {x: 45, y: 85}, {x: 55, y: 85}] },
  { name: "Crossed Arms", points: [{x: 50, y: 15}, {x: 50, y: 35}, {x: 40, y: 38}, {x: 60, y: 38}, {x: 50, y: 90}] },
  { name: "The Thinker", points: [{x: 45, y: 20}, {x: 48, y: 35}, {x: 55, y: 50}, {x: 40, y: 55}, {x: 50, y: 80}] },
  { name: "Squat Pose", points: [{x: 50, y: 40}, {x: 45, y: 55}, {x: 55, y: 55}, {x: 35, y: 75}, {x: 65, y: 75}] },
  { name: "Back View", points: [{x: 50, y: 15}, {x: 50, y: 40}, {x: 40, y: 90}, {x: 60, y: 90}] },
  { name: "Side Lean Wall", points: [{x: 30, y: 15}, {x: 35, y: 40}, {x: 40, y: 70}, {x: 45, y: 95}] },
  { name: "Looking Up", points: [{x: 50, y: 10}, {x: 50, y: 35}, {x: 45, y: 90}, {x: 55, y: 90}] },
  { name: "Crouch Shot", points: [{x: 50, y: 50}, {x: 40, y: 65}, {x: 60, y: 65}, {x: 50, y: 90}] },
  { name: "Hands up High", points: [{x: 50, y: 30}, {x: 30, y: 10}, {x: 70, y: 10}, {x: 45, y: 90}, {x: 55, y: 90}] },
  { name: "Elegant Stand", points: [{x: 50, y: 12}, {x: 50, y: 30}, {x: 45, y: 50}, {x: 52, y: 75}, {x: 48, y: 95}] },
  { name: "City Vibe", points: [{x: 55, y: 15}, {x: 52, y: 35}, {x: 40, y: 55}, {x: 65, y: 55}] },
  { name: "Playful Turn", points: [{x: 45, y: 15}, {x: 55, y: 30}, {x: 35, y: 50}, {x: 65, y: 70}] },
  { name: "Model Walk", points: [{x: 50, y: 10}, {x: 50, y: 30}, {x: 45, y: 60}, {x: 55, y: 90}] },
  { name: "Silly Pose", points: [{x: 50, y: 20}, {x: 35, y: 40}, {x: 65, y: 40}, {x: 40, y: 80}, {x: 60, y: 80}] },
  { name: "Chill Mode", points: [{x: 50, y: 25}, {x: 40, y: 45}, {x: 60, y: 45}, {x: 50, y: 85}] },
  { name: "High Fashion", points: [{x: 48, y: 12}, {x: 52, y: 28}, {x: 40, y: 55}, {x: 70, y: 45}] },
  { name: "Swaying Pose", points: [{x: 50, y: 15}, {x: 45, y: 40}, {x: 55, y: 65}, {x: 50, y: 90}] },
  { name: "Hidden Face", points: [{x: 50, y: 15}, {x: 45, y: 20}, {x: 55, y: 20}, {x: 50, y: 50}] },
  { name: "Retro Look", points: [{x: 50, y: 20}, {x: 40, y: 40}, {x: 60, y: 60}, {x: 50, y: 85}] },
  { name: "Minimalist", points: [{x: 50, y: 10}, {x: 50, y: 90}] },
  { name: "A-Frame Stand", points: [{x: 50, y: 15}, {x: 40, y: 90}, {x: 60, y: 90}] },
  { name: "V-Shape Arms", points: [{x: 50, y: 35}, {x: 30, y: 15}, {x: 70, y: 15}] },
  { name: "L-Pose Step", points: [{x: 45, y: 15}, {x: 45, y: 60}, {x: 65, y: 60}] },
  { name: "T-Pose Assist", points: [{x: 50, y: 15}, {x: 20, y: 40}, {x: 80, y: 40}, {x: 50, y: 85}] },
  { name: "Zig Zag Look", points: [{x: 40, y: 10}, {x: 60, y: 30}, {x: 40, y: 50}, {x: 60, y: 70}] },
  { name: "Circle Frame", points: [{x: 50, y: 20}, {x: 30, y: 50}, {x: 70, y: 50}, {x: 50, y: 80}] },
  { name: "Stair Pose", points: [{x: 40, y: 20}, {x: 50, y: 40}, {x: 60, y: 60}, {x: 70, y: 80}] },
  { name: "Diagonal Lean", points: [{x: 20, y: 20}, {x: 50, y: 50}, {x: 80, y: 80}] },
  { name: "Center Focus", points: [{x: 50, y: 50}] },
  { name: "Dual Subject 1", points: [{x: 30, y: 30}, {x: 70, y: 30}] },
  { name: "Dual Subject 2", points: [{x: 30, y: 70}, {x: 70, y: 70}] },
  { name: "Pyramid Focus", points: [{x: 50, y: 20}, {x: 30, y: 80}, {x: 70, y: 80}] },
  { name: "Dynamic S", points: [{x: 50, y: 10}, {x: 70, y: 30}, {x: 30, y: 60}, {x: 50, y: 90}] },
  { name: "Corner Frame", points: [{x: 10, y: 10}, {x: 10, y: 30}, {x: 30, y: 10}] },
  { name: "Box Frame", points: [{x: 25, y: 25}, {x: 75, y: 25}, {x: 75, y: 75}, {x: 25, y: 75}] },
  { name: "Cross Focus", points: [{x: 50, y: 20}, {x: 50, y: 80}, {x: 20, y: 50}, {x: 80, y: 50}] },
  { name: "Spiral Flow", points: [{x: 50, y: 50}, {x: 60, y: 40}, {x: 50, y: 30}, {x: 40, y: 40}, {x: 30, y: 50}] },
  { name: "Geometric 1", points: [{x: 10, y: 10}, {x: 90, y: 90}, {x: 10, y: 90}, {x: 90, y: 10}] },
  { name: "Modern Minimal", points: [{x: 50, y: 40}, {x: 45, y: 45}, {x: 55, y: 45}, {x: 50, y: 60}] }
];

function PasPhotoGuide({ size, subjectBox }: { size: PasPhotoSize, subjectBox: any }) {
  const getAspectRatio = () => {
    switch(size) {
      case '2x3': return 2/3;
      case '3x4': return 3/4;
      case '4x6': return 4/6;
      default: return 3/4;
    }
  };

  // Check alignment if subjectBox exists
  // subjectBox values are 0-1000, we convert them to percentage
  const isAligned = subjectBox && (
    subjectBox.xmin > 200 && subjectBox.xmax < 800 &&
    subjectBox.ymin > 100 && subjectBox.ymax < 600
  );

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center p-8"
    >
      <div 
        className={`border-4 border-dashed relative transition-colors duration-500 bg-black/10 backdrop-blur-[2px] ${isAligned ? 'border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.3)]' : 'border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.2)]'}`}
        style={{ 
          aspectRatio: getAspectRatio(),
          height: '80%',
          maxHeight: '75vh'
        }}
      >
        {/* Avatar Placeholder */}
        <div className="absolute inset-0 flex flex-col items-center justify-center opacity-40">
           <svg viewBox="0 0 100 100" className="w-[80%] h-[80%] fill-accent/20 stroke-accent stroke-[0.5]">
             <circle cx="50" cy="35" r="18" />
             <path d="M20,85 Q20,55 50,55 Q80,55 80,85" fill="none" />
             <path d="M25,85 Q25,60 50,60 Q75,60 75,85" />
           </svg>
        </div>
        
        {/* Alignment Indicators */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
          <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl transition-colors ${isAligned ? 'bg-green-500 text-white' : 'bg-red-500 text-white animate-pulse'}`}>
            {isAligned ? 'Subject Aligned' : 'Align Subject'}
          </div>
          <span className="text-[10px] font-bold text-white drop-shadow-md">PAS PHOTO {size}</span>
        </div>

        {/* Framing Corners */}
        <div className="absolute top-0 left-0 w-8 h-8 border-l-4 border-t-4 border-white/30" />
        <div className="absolute top-0 right-0 w-8 h-8 border-r-4 border-t-4 border-white/30" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-l-4 border-b-4 border-white/30" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-r-4 border-b-4 border-white/30" />
      </div>
    </motion.div>
  );
}

function DotSilhouette({ poseIndex }: { poseIndex: number }) {
  const pose = DOT_POSES[poseIndex] || DOT_POSES[0];
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.8 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 pointer-events-none z-30"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_10px_rgba(255,77,0,0.5)]">
        {/* Faint Humanoid Body Background */}
        <path 
           d="M50,10 Q50,5 50,10 Q42,10 42,18 Q42,25 50,25 Q58,25 58,18 Q58,10 50,10 M40,30 L60,30 L65,60 L58,95 L42,95 L35,60 Z" 
           fill="#FF4D00" 
           opacity="0.05"
        />
        
        {pose.points.map((p, i) => (
          <g key={i}>
            <motion.circle
              cx={p.x}
              cy={p.y}
              r="1.4"
              fill="#FF4D00"
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.2, 1] }}
              transition={{ delay: i * 0.03 }}
            />
            <circle cx={p.x} cy={p.y} r="1.4" fill="none" stroke="white" strokeWidth="0.2" opacity="0.5" />
          </g>
        ))}
        {/* Connecting Lines for "Skeleton" look */}
        <polyline
          points={pose.points.map(p => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="#FF4D00"
          strokeWidth="0.3"
          opacity="0.6"
        />
      </svg>
      <div className="absolute bottom-[20%] left-1/2 -translate-x-1/2 bg-accent/30 backdrop-blur-xl px-4 py-1.5 rounded-full border border-accent/50 flex flex-col items-center">
        <span className="text-[10px] text-white font-black uppercase tracking-[0.2em]">{pose.name}</span>
        <span className="text-[7px] text-accent-foreground/70 uppercase font-bold tracking-tighter">Follow the Dots</span>
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
  const [pasPhotoSize, setPasPhotoSize] = useState<PasPhotoSize>('3x4');
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
  const [useManualTime, setUseManualTime] = useState(false);
  const [manualTimeValue, setManualTimeValue] = useState(new Date().toTimeString().slice(0, 5));
  const [timemarkFontSize, setTimemarkFontSize] = useState(32);
  const [locationText, setLocationText] = useState("Pro Sensor Active");
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleString());
  const [showSettings, setShowSettings] = useState(false);
  const [useManualLocation, setUseManualLocation] = useState(false);
  const [manualLocationText, setManualLocationText] = useState("");
  const [focusPoint, setFocusPoint] = useState({ x: 50, y: 50 }); // Percentage
  const [showFocusRing, setShowFocusRing] = useState(false);
  
  // Tilt/Level State
  const [tilt, setTilt] = useState({ roll: 0, pitch: 0 });
  const [showLevel, setShowLevel] = useState(true);

  // Filter State
  const [activeFilter, setActiveFilter] = useState<FilterPreset>(FILTER_PRESETS[0]);
  const [showFilters, setShowFilters] = useState(false);
  const [focusMode, setFocusMode] = useState<FocusMode>('FOCUS_SUBJECT');
  const [aiHumanDetection, setAiHumanDetection] = useState(false);
  const [subjectBox, setSubjectBox] = useState<{ymin:number, xmin:number, ymax:number, xmax:number} | null>(null);

  const handleViewfinderTap = (e: React.MouseEvent | React.TouchEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    
    setFocusPoint({ x, y });
    setShowFocusRing(true);
    // When tapping, we might want to toggle the focus mode if tapped near same area, 
    // or just reset subject box to manual mode
    setSubjectBox(null); 
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
          const address = data.display_name || "";
          setLocationText(address);
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
  const [focusAreaSize, setFocusAreaSize] = useState(25); // 10 to 70
  const [iso, setIso] = useState(1); // 1 to 5
  const [resolution, setResolution] = useState<'HD' | 'UHD'>('UHD');
  const [uiVisible, setUiVisible] = useState(true);
  
  // AI State
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<{ 
    objects: string[], 
    tips: string[], 
    pose?: string,
    recommended_filter_id?: string
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

      // 2. Constraints for Selected Resolution
      const resSettings = {
        HD: { w: 1920, h: 1080 },
        UHD: { w: 3840, h: 2160 }
      };
      
      const constraints: MediaStreamConstraints = { 
        video: { 
          facingMode: { ideal: facingMode }, 
          width: { ideal: resSettings[resolution].w, min: 1280 },
          height: { ideal: resSettings[resolution].h, min: 720 },
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
  }, [facingMode, hasStarted, resolution]);

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

  // Handle Auto-Assist & Continuous Tracking
  useEffect(() => {
    let interval: any;
    // Frequency increases if Human Detection is on for "continuous" tracking feel
    const frequency = aiHumanDetection ? 4000 : 10000;
    
    if ((autoAssist || aiHumanDetection) && !aiAnalyzing) {
      interval = setInterval(() => {
        analyzeScene();
      }, frequency);
    }
    return () => clearInterval(interval);
  }, [autoAssist, aiHumanDetection, aiAnalyzing]);

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
      // Handle Mirroring for Front Camera Capture
      if (facingMode === 'user') {
        ctx.translate(video.videoWidth, 0);
        ctx.scale(-1, 1);
      }

      // Selective Blur Logic
      const blurVal = focus > 0 ? focus / 4 : 0; 
      const baseFilters = `brightness(${1 + exposure / 100}) contrast(${1 + Math.abs(exposure) / 200}) hue-rotate(${wb * 0.5}deg) saturate(${1 + iso / 10}) ${activeFilter.css}`;
      const sharpFilters = baseFilters;
      const blurredFilters = `${sharpFilters} blur(${blurVal}px)`;
      
      if (blurVal > 0) {
        // Mode 1: Focus Subject (Subject is Sharp), Mode 2: Blur Subject (Subject is Blur)
        const isBlurSubject = focusMode === 'BLUR_SUBJECT';
        
        // Build the mask
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = video.videoWidth;
        maskCanvas.height = video.videoHeight;
        const mctx = maskCanvas.getContext('2d');
        
        if (mctx) {
          if (aiHumanDetection && subjectBox) {
            // Sophisticated Human Detection Mask
            const bx = subjectBox.xmin * video.videoWidth / 1000;
            const by = subjectBox.ymin * video.videoHeight / 1000;
            const bw = (subjectBox.xmax - subjectBox.xmin) * video.videoWidth / 1000;
            const bh = (subjectBox.ymax - subjectBox.ymin) * video.videoHeight / 1000;
            
            // Draw a smooth rounded box for the human
            mctx.fillStyle = 'white';
            const radius = Math.min(bw, bh) * 0.3;
            mctx.beginPath();
            mctx.roundRect(bx - radius/2, by - radius/2, bw + radius, bh + radius, radius);
            mctx.fill();
            // Blurring the mask for soft edges
            mctx.filter = 'blur(20px)';
            mctx.drawImage(maskCanvas, 0, 0);
          } else {
            // Manual Point Mask
            const effectiveX = facingMode === 'user' ? (100 - focusPoint.x) : focusPoint.x;
            const fX = (effectiveX / 100) * video.videoWidth;
            const fY = (focusPoint.y / 100) * video.videoHeight;
            const innerRadius = Math.min(video.videoWidth, video.videoHeight) * (focusAreaSize / 100);
            const outerRadius = Math.min(video.videoWidth, video.videoHeight) * ((focusAreaSize + 30) / 100);
            
            const gradient = mctx.createRadialGradient(fX, fY, innerRadius, fX, fY, outerRadius);
            gradient.addColorStop(0, 'white');
            gradient.addColorStop(1, 'transparent');
            mctx.fillStyle = gradient;
            mctx.fillRect(0, 0, video.videoWidth, video.videoHeight);
          }

          if (isBlurSubject) {
            // Background is Sharp, Touched Point is Blur
            ctx.filter = sharpFilters;
            ctx.drawImage(video, 0, 0);
            
            const blurCanvas = document.createElement('canvas');
            blurCanvas.width = video.videoWidth;
            blurCanvas.height = video.videoHeight;
            const bctx = blurCanvas.getContext('2d');
            if (bctx) {
              bctx.filter = blurredFilters;
              bctx.drawImage(video, 0, 0);
              bctx.globalCompositeOperation = 'destination-in';
              bctx.drawImage(maskCanvas, 0, 0);
              
              ctx.save();
              ctx.filter = 'none';
              ctx.globalCompositeOperation = 'source-over';
              ctx.drawImage(blurCanvas, 0, 0);
              ctx.restore();
            }
          } else {
            // Background is Blur, Touched Point is Sharp (Default Bokeh)
            ctx.filter = blurredFilters;
            ctx.drawImage(video, 0, 0);
            
            const sharpCanvas = document.createElement('canvas');
            sharpCanvas.width = video.videoWidth;
            sharpCanvas.height = video.videoHeight;
            const sctx = sharpCanvas.getContext('2d');
            if (sctx) {
              sctx.filter = sharpFilters;
              sctx.drawImage(video, 0, 0);
              sctx.globalCompositeOperation = 'destination-in';
              sctx.drawImage(maskCanvas, 0, 0);
              
              ctx.save();
              ctx.filter = 'none';
              ctx.globalCompositeOperation = 'source-over';
              ctx.drawImage(sharpCanvas, 0, 0);
              ctx.restore();
            }
          }
        }
      } else {
        // Standard draw no blur
        ctx.filter = sharpFilters;
        ctx.drawImage(video, 0, 0);
      }
      
      // Reset filter for Timemark text overlay
      ctx.filter = 'none';
      
      // Burn-in Timemark if enabled
      if (timemarkEnabled) {
        ctx.font = `bold ${timemarkFontSize}px "JetBrains Mono", monospace`;
        ctx.fillStyle = 'white';
        ctx.shadowBlur = 6;
        ctx.shadowColor = 'black';
        ctx.textAlign = 'left';
        
        // Formatting Indonesian Date
        const daysIndo = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
        const d = useManualDate ? new Date(`${manualDateValue}T00:00:00`) : new Date();
        const formattedDate = `${daysIndo[d.getDay()]}, ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
        
        let timeString = "";
        if (useManualTime) {
          timeString = manualTimeValue;
        } else if (!useManualDate) {
          timeString = new Date().toLocaleTimeString();
        }
        
        const timestamp = formattedDate + (timeString ? ` • ${timeString}` : "");
        
        let displayLocation = useManualLocation ? manualLocationText : locationText;
        const address = timemarkManualText ? `${timemarkManualText} • ${displayLocation}` : displayLocation;
        
        ctx.fillText(timestamp, 40, video.videoHeight - (timemarkFontSize * 3.125));
        ctx.font = `${Math.round(timemarkFontSize * 0.75)}px "JetBrains Mono", monospace`;
        ctx.fillText(address, 40, video.videoHeight - (timemarkFontSize * 1.875));
      }

      setCapturedImage(canvas.toDataURL('image/jpeg', 0.95)); // High Quality
    }
    
    setTimeout(() => setIsCapturing(false), 300);
  }, [timemarkEnabled, timemarkManualText, locationText, useManualDate, manualDateValue, useManualTime, manualTimeValue, useManualLocation, manualLocationText, timemarkFontSize, exposure, wb, iso, focus, focusAreaSize, focusPoint, activeFilter, facingMode, focusMode, aiHumanDetection, subjectBox]);
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
              { text: `Analyze this camera view. 
                       1. Identify main objects.
                       2. Recommend the best filter ID from available: standard, vibrant, iphone_vibrant, iphone_warm, iphone_cool, cinematic, noir.
                       3. If humans are present, provide ONE main bounding box [ymin, xmin, ymax, xmax] in 0-1000 normalized coordinates for the primary person.
                       4. Based on light and subject, suggest 2 professional photography tips.
                       
                       Return JSON strictly: { 
                         "objects": [], 
                         "tips": [], 
                         "recommended_filter_id": "string",
                         "subject_box": [ymin, xmin, ymax, xmax] | null
                       }` },
              { inlineData: { mimeType: "image/jpeg", data: base64Image } }
            ]
          }
        ],
        config: { responseMimeType: "application/json" }
      });

      const data = JSON.parse(response.text || '{}');
      setAiFeedback(data);
      
      if (data.recommended_filter_id) {
        const found = FILTER_PRESETS.find(f => f.id === data.recommended_filter_id);
        if (found) setActiveFilter(found);
      }

      if (data.subject_box) {
        setSubjectBox({
          ymin: data.subject_box[0],
          xmin: data.subject_box[1],
          ymax: data.subject_box[2],
          xmax: data.subject_box[3]
        });
        
        // Auto-align focus point and bokeh center to detected subject
        const centerX = (data.subject_box[1] + data.subject_box[3]) / 20; // Convert 0-1000 to 0-100
        const centerY = (data.subject_box[0] + data.subject_box[2]) / 20;
        setFocusPoint({ x: centerX, y: centerY });
      }
    } catch (err) {
      console.error("AI Analysis failed", err);
    } finally {
      setAiAnalyzing(false);
    }
  };

  // Dynamically calculate filters based on manual controls + Selection
  // Adding a "Smart Enhance" pass to all filters for "Auto Color Adjustment"
  const smartPass = "brightness(1.02) contrast(1.05) saturate(1.02)";
  const cameraFilters = `
    ${smartPass}
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
          
          <div className="pt-6 flex flex-col items-center gap-4">
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

            <button 
              onClick={toggleFullscreen}
              className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-[11px] uppercase font-bold tracking-[0.2em] border border-white/10 px-6 py-3 rounded-full hover:bg-white/5 active:scale-95"
            >
              <Maximize size={16} />
              <span>Full Screen</span>
            </button>

            <p className="mt-4 text-[10px] text-text-dim font-mono tracking-widest opacity-30">
              OPTIMIZED FOR MOBILE HP • VER 2.2.0
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-bg flex flex-col font-sans text-text-dim selection:bg-accent/30">
      {/* Top Bar - Recalibrated for Prof. Polish */}
      <div className="h-14 flex items-center justify-between px-4 md:px-8 bg-black z-30 font-mono text-[10px] md:text-[12px] border-b border-ui-border">
        <div className="flex items-center gap-3 md:gap-6">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-accent animate-pulse" />
            <button 
              onClick={() => setResolution(resolution === 'UHD' ? 'HD' : 'UHD')}
              className="text-white font-bold tracking-tight hover:text-accent transition-colors flex items-center gap-1 group whitespace-nowrap"
              title="Change Resolution"
            >
              <span>{resolution === 'UHD' ? '4K UHD' : '1080P HD'}</span>
              <ChevronDown size={12} className="opacity-30 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>
          <span className="opacity-50 hidden sm:block">RAW+JPG</span>
        </div>
        
        <div className="flex items-center gap-4 md:gap-8 overflow-x-auto no-scrollbar">
          <div className="items-center gap-3 hidden md:flex">
             <span className="opacity-50">STABILIZATION: ON</span>
             <div className="w-8 h-4 border border-white/30 p-[1px] relative">
               <div className="h-full bg-emerald-500 w-[85%]" />
             </div>
             <span className="text-white">85%</span>
          </div>
          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            <button 
              onClick={() => window.location.reload()}
              className="p-1.5 hover:text-white transition-colors" 
              title="Refresh Camera"
            >
              <RotateCw size={16} className="md:w-[18px] md:h-[18px]" />
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
              <Home size={16} className="md:w-[18px] md:h-[18px]" />
            </button>
            <button onClick={toggleFullscreen} className="p-1.5 hover:text-white transition-colors" title="Full Screen">
              <Maximize size={16} className="md:w-[18px] md:h-[18px]" />
            </button>
            <button onClick={() => setShowGrid(!showGrid)} className={`p-1.5 transition-colors ${showGrid ? 'text-accent' : 'hover:text-white'}`}>
              <Grid3X3 size={16} className="md:w-[18px] md:h-[18px]" />
            </button>
            <button className="p-1.5 hover:text-white transition-colors" onClick={() => setShowSettings(!showSettings)}>
              <Settings size={16} className="md:w-[18px] md:h-[18px]" />
            </button>
            <button 
              onClick={() => setUiVisible(!uiVisible)} 
              className={`p-1.5 transition-colors ${!uiVisible ? 'text-accent' : 'hover:text-white'}`}
              title={uiVisible ? "Hide UI" : "Show UI"}
            >
              {uiVisible ? <Eye size={16} className="md:w-[18px] md:h-[18px]" /> : <EyeOff size={16} className="md:w-[18px] md:h-[18px]" />}
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
            
            {/* Settings Sections */}
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <span className="text-[10px] uppercase font-bold tracking-tighter">AI Human Bokeh</span>
                <button 
                  onClick={() => setAiHumanDetection(!aiHumanDetection)}
                  className={`w-10 h-5 rounded-full relative transition-colors ${aiHumanDetection ? 'bg-accent' : 'bg-white/10'}`}
                >
                  <div className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-transform ${aiHumanDetection ? 'translate-x-5' : ''}`} />
                </button>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <span className="text-[10px] uppercase font-bold tracking-tighter">Touch Mode</span>
                <button 
                  onClick={() => setFocusMode(focusMode === 'FOCUS_SUBJECT' ? 'BLUR_SUBJECT' : 'FOCUS_SUBJECT')}
                  className="bg-white/10 border border-white/10 rounded-lg px-2 py-1 text-[8px] text-white hover:border-accent transition-colors uppercase font-bold"
                >
                  {focusMode === 'FOCUS_SUBJECT' ? 'Focus Subject' : 'Blur Subject'}
                </button>
              </div>

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
                     
                     {/* Font Size Slider */}
                     <div className="space-y-2 py-1">
                       <div className="flex justify-between text-[8px] uppercase text-text-dim">
                         <span>Font Size</span>
                         <span className="text-white">{timemarkFontSize}px</span>
                       </div>
                       <input 
                         type="range"
                         min={20}
                         max={80}
                         step={2}
                         value={timemarkFontSize}
                         onChange={(e) => setTimemarkFontSize(Number(e.target.value))}
                         className="w-full h-1 bg-white/10 appearance-none rounded-full accent-accent cursor-pointer"
                       />
                     </div>
                     
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

                     {/* Manual Time Toggle */}
                     <div className="flex items-center justify-between py-2 border-t border-white/5">
                        <span className="text-[9px] text-white/60">Use Manual Time</span>
                        <button 
                          onClick={() => setUseManualTime(!useManualTime)}
                          className={`w-8 h-4 rounded-full relative transition-colors ${useManualTime ? 'bg-accent' : 'bg-white/10'}`}
                        >
                          <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${useManualTime ? 'translate-x-4' : ''}`} />
                        </button>
                     </div>

                     {useManualTime && (
                        <input 
                          type="time"
                          value={manualTimeValue}
                          onChange={(e) => setManualTimeValue(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white focus:outline-none focus:border-accent"
                        />
                     )}

                     {/* Manual Location Toggle */}
                     <div className="flex items-center justify-between py-2 border-t border-white/5">
                        <span className="text-[9px] text-white/60">Use Manual Address</span>
                        <button 
                          onClick={() => setUseManualLocation(!useManualLocation)}
                          className={`w-8 h-4 rounded-full relative transition-colors ${useManualLocation ? 'bg-accent' : 'bg-white/10'}`}
                        >
                          <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${useManualLocation ? 'translate-x-4' : ''}`} />
                        </button>
                     </div>

                     {useManualLocation ? (
                        <textarea 
                          placeholder="Enter full address manually..."
                          value={manualLocationText}
                          onChange={(e) => setManualLocationText(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white focus:outline-none focus:border-accent min-h-[60px] resize-none"
                        />
                     ) : (
                        <div className="flex items-center gap-2 text-[8px] text-text-dim pt-1">
                          <MapPin size={8} />
                          <span className="line-clamp-2 leading-relaxed">{locationText}</span>
                        </div>
                     )}
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
          {/* Smart AI Detection Ring (Invisible if not detected) */}
          {aiHumanDetection && subjectBox && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ 
                opacity: 1,
                left: `${subjectBox.xmin/10}%`,
                top: `${subjectBox.ymin/10}%`,
                width: `${(subjectBox.xmax - subjectBox.xmin)/10}%`,
                height: `${(subjectBox.ymax - subjectBox.ymin)/10}%`
              }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="absolute pointer-events-none border-2 border-accent/50 rounded-xl"
            >
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-accent text-white text-[8px] px-2 py-0.5 rounded-full font-bold uppercase whitespace-nowrap flex items-center gap-1.5 shadow-lg shadow-accent/20">
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                AI Subject Tracking • Locked
              </div>
            </motion.div>
          )}

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
              className={`w-full h-full object-cover transition-all ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
              style={{ 
                filter: cameraFilters,
                WebkitFilter: cameraFilters,
              }}
            />
          )}

          {/* Side Panel Overlay (Theme Design) */}
          <AnimatePresence>
            {uiVisible && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-40 max-h-[85vh] overflow-y-auto overflow-x-hidden no-scrollbar py-4 px-1 pr-2"
              >
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
              </motion.div>
            )}
          </AnimatePresence>

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
                className="absolute right-20 md:right-24 top-1/2 -translate-y-1/2 z-50 bg-panel border border-ui-border rounded-2xl p-2 flex flex-col gap-2 backdrop-blur-xl max-h-[45vh] overflow-y-auto custom-scrollbar pr-3 scroll-smooth"
                style={{ 
                  maskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)',
                  WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)'
                }}
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
            {mode === 'PAS_PHOTO' && (
              <PasPhotoGuide size={pasPhotoSize} subjectBox={subjectBox} />
            )}
            {(showPoseDots || mode === 'FREE_POSE') && (
              <DotSilhouette poseIndex={mode === 'FREE_POSE' ? poseIndex : (recommendedPoseIdx ?? 0)} />
            )}
          </AnimatePresence>

          {/* Portrait Blur Effect - Now driven by focus slider and tap point */}
          <div 
            className="absolute inset-0 pointer-events-none transition-all duration-700"
            style={{ 
              backdropFilter: focus > 0 ? `blur(${focus / 5}px)` : 'none',
              maskImage: focus > 0 ? `radial-gradient(circle at ${focusPoint.x}% ${focusPoint.y}%, transparent ${focusAreaSize}%, black ${focusAreaSize + 40}%)` : 'none',
              WebkitMaskImage: focus > 0 ? `radial-gradient(circle at ${focusPoint.x}% ${focusPoint.y}%, transparent ${focusAreaSize}%, black ${focusAreaSize + 40}%)` : 'none'
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

                    {aiFeedback.recommended_filter_id && (
                      <div className="pt-2 border-t border-white/5">
                        <span className="text-[8px] text-white/40 uppercase tracking-widest block mb-1">Recommended Filter</span>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <p className="text-[10px] text-accent font-bold uppercase">
                            {FILTER_PRESETS.find(f => f.id === aiFeedback.recommended_filter_id)?.name || "Recommended"}
                          </p>
                          <button 
                            onClick={() => {
                              const filter = FILTER_PRESETS.find(f => f.id === aiFeedback.recommended_filter_id);
                              if (filter) setActiveFilter(filter);
                            }}
                            className="bg-accent px-2 py-1 rounded text-[8px] font-bold text-white uppercase hover:bg-accent/80 transition-colors"
                          >
                            Apply
                          </button>
                        </div>
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
      <div className="bg-[#111] border-t border-ui-border z-30 overflow-hidden transition-all duration-500 relative">
        <div className="flex flex-col md:grid md:grid-cols-[1.2fr,2fr,0.8fr] items-center px-6 md:px-10 py-4 gap-4">
          
          {/* Left: Blur Slider Area */}
          <AnimatePresence>
            {uiVisible && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="w-full space-y-3 max-w-[300px] md:max-w-none"
              >
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

                {focus > 0 && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-left-2 duration-300 pb-2">
                    <div className="flex items-center justify-between text-[9px] font-bold text-text-dim uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <Maximize size={10} className="text-accent" />
                        <span>Subject Focus Area</span>
                      </div>
                      <span className="text-white italic">{focusAreaSize}%</span>
                    </div>
                    <input 
                      type="range" 
                      min={10} 
                      max={70} 
                      value={focusAreaSize} 
                      onChange={(e) => setFocusAreaSize(Number(e.target.value))}
                      className="w-full h-1 bg-[#222] appearance-none rounded-full accent-accent cursor-pointer"
                    />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Center: Modes + Shutter */}
          <div className="flex flex-col items-center gap-4 py-2">
            <AnimatePresence>
              {uiVisible && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="flex gap-4 md:gap-8 text-[9px] md:text-[11px] font-bold tracking-[0.1em] uppercase overflow-x-auto no-scrollbar w-full max-w-[90vw] justify-start md:justify-center px-4"
                >
                  {(['PHOTO', 'PORTRAIT', 'LANDSCAPE', 'PRO', 'PAS_PHOTO', 'FREE_POSE'] as Mode[]).map(m => (
                    <button 
                      key={m}
                      onClick={() => {
                        setMode(m);
                        if (m === 'FREE_POSE') setShowPoseDots(true);
                      }}
                      className={`relative transition-all pt-2 pb-3 shrink-0 ${mode === m ? 'text-white' : 'text-text-dim hover:text-white'}`}
                    >
                      <span className="whitespace-nowrap">{m.replace('_', ' ')}</span>
                      {mode === m && (
                        <motion.div layoutId="modeDot" className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent" />
                      )}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Sub-selectors for Pas Photo and Free Pose */}
            <AnimatePresence>
              {uiVisible && (
                <div className="h-6">
                  {mode === 'PAS_PHOTO' && (
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      className="flex gap-4"
                    >
                      {(['2x3', '3x4', '4x6'] as PasPhotoSize[]).map(s => (
                        <button 
                          key={s}
                          onClick={() => setPasPhotoSize(s)}
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-md transition-colors ${pasPhotoSize === s ? 'bg-accent text-white' : 'text-text-dim hover:text-white'}`}
                        >
                          {s}
                        </button>
                      ))}
                    </motion.div>
                  )}
                  {mode === 'FREE_POSE' && (
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-[300px] px-4"
                    >
                      <button 
                        onClick={() => setPoseIndex((prev) => (prev - 1 + DOT_POSES.length) % DOT_POSES.length)}
                        className="p-1 text-white/20 hover:text-white transition-colors"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <div className="flex flex-col items-center min-w-[80px]">
                        <span className="text-[8px] text-accent font-bold uppercase tracking-widest leading-none mb-1">Template</span>
                        <span className="text-[10px] text-white font-mono whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                          {poseIndex + 1}/{DOT_POSES.length}: {DOT_POSES[poseIndex].name}
                        </span>
                      </div>
                      <button 
                        onClick={() => setPoseIndex((prev) => (prev + 1) % DOT_POSES.length)}
                        className="p-1 text-white/20 hover:text-white transition-colors"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </motion.div>
                  )}
                </div>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-6 md:gap-12">
              <AnimatePresence>
                {uiVisible && (
                  <>
                    <motion.button 
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      onClick={() => {
                        setShowPoseDots(!showPoseDots);
                        if (!showPoseDots) analyzeScene(); 
                      }}
                      className={`p-3 md:p-4 rounded-full border transition-all ${showPoseDots ? 'border-accent bg-accent/20' : 'border-white/10'}`}
                      title="AI Pose Recommendation"
                    >
                      <Info size={20} className={showPoseDots ? 'text-accent' : 'text-white'} />
                    </motion.button>

                    <motion.button 
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      onClick={() => setAutoAssist(!autoAssist)}
                      className={`p-3 md:p-4 rounded-full border transition-all ${autoAssist ? 'border-accent bg-accent/10' : 'border-white/10 hover:border-accent'}`}
                    >
                      <Target size={20} className={autoAssist ? 'text-accent' : 'text-white'} />
                    </motion.button>
                  </>
                )}
              </AnimatePresence>

              <button 
                onClick={capturePhoto}
                className={`w-20 h-20 md:w-24 md:h-24 rounded-full border-[4px] md:border-[6px] border-white p-1.5 hover:scale-105 active:scale-95 transition-all group ${!uiVisible ? 'ring-4 ring-accent/30' : ''}`}
              >
                <div className="w-full h-full rounded-full bg-white group-hover:bg-white/90 transition-colors" />
              </button>

              <AnimatePresence>
                {uiVisible && (
                  <motion.button 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    onClick={toggleCamera}
                    className="p-3 md:p-4 rounded-full border border-white/10 hover:border-white transition-colors"
                  >
                    <RotateCcw size={20} className={facingMode === 'user' ? 'rotate-180' : ''} />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Right: Info Area */}
          <AnimatePresence>
            {uiVisible && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex md:flex-col items-center justify-end w-full gap-4 md:gap-1 text-right"
              >
                <button 
                  onClick={() => setPoseIndex((poseIndex + 1) % poses.length)}
                  className="text-right group"
                >
                  <span className="text-[10px] text-text-dim font-bold uppercase tracking-widest block group-hover:text-accent transition-colors">Switch Pose Guide</span>
                  <p className="text-[12px] text-white leading-tight font-mono group-hover:underline">
                    {poses[poseIndex].name} Assist
                  </p>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Gallery Modal / Captured Preview */}
      <AnimatePresence>
        {capturedImage && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[100] bg-black/98 flex flex-col items-center justify-center p-4 md:p-12 overflow-hidden"
          >
            <div className="relative w-full max-w-5xl h-full flex flex-col gap-6">
               {/* Header Info */}
               <div className="flex items-center justify-between text-white border-b border-white/5 pb-4 px-2">
                 <div className="flex flex-col">
                   <div className="flex items-center gap-3">
                     <div className="w-2.5 h-2.5 rounded-full bg-accent relative shrink-0">
                       <div className="absolute inset-0 rounded-full bg-accent animate-ping opacity-50" />
                     </div>
                     <span className="text-accent font-serif italic text-2xl md:text-3xl tracking-tight">Lumix Pro Master</span>
                   </div>
                   <span className="text-[10px] uppercase tracking-[0.3em] opacity-40 ml-6 font-mono hidden md:block">Neural Engine Processing • HDR Active • 2026 Studio System</span>
                   <span className="text-[8px] uppercase tracking-[0.2em] opacity-40 ml-6 font-mono md:hidden mt-1">Neural Engine Active</span>
                 </div>
                 <button onClick={() => setCapturedImage(null)} className="p-3 hover:bg-white/10 rounded-full transition-all active:scale-90 group border border-white/5">
                   <X size={32} className="group-hover:rotate-90 transition-transform duration-300" />
                 </button>
               </div>
               
               {/* High-End Image Preview Section */}
               <div className="flex-1 relative rounded-3xl overflow-hidden shadow-[0_0_80px_rgba(255,77,0,0.15)] border border-white/10 group bg-[#080808] flex items-center justify-center">
                 <img src={capturedImage} className="max-w-full max-h-full object-contain" alt="Captured" referrerPolicy="no-referrer" />
                 
                 {/* Floating Labels */}
                 <div className="absolute top-6 left-6 hidden md:flex flex-col gap-2">
                   <div className="px-4 py-2 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-xl text-[10px] uppercase font-bold tracking-widest text-accent flex items-center gap-2">
                     <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                     {mode} Mode
                   </div>
                   <div className="px-4 py-2 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-xl text-[10px] uppercase font-bold tracking-widest text-white/80">
                     {activeFilter.name} Optimization
                   </div>
                 </div>

                 {/* EXIF Watermark Style */}
                 <div className="absolute bottom-6 left-6 hidden md:flex flex-col opacity-50">
                    <span className="font-mono text-[10px] tracking-widest text-white">LMXP-2026-STUDIO-OPT</span>
                    <span className="font-mono text-[8px] tracking-[0.5em] text-white/60">0419_1742_SYS</span>
                 </div>
               </div>
               
               {/* Enhanced Action Controls */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                 <button 
                  onClick={() => setCapturedImage(null)}
                  className="py-5 rounded-2xl bg-white/5 border border-white/10 text-white font-bold uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-4 backdrop-blur-xl group active:scale-[0.98]"
                 >
                   <RotateCcw size={20} className="group-hover:-rotate-45 transition-transform" />
                   <span className="text-sm">Retake Image</span>
                 </button>
                 <a 
                  href={capturedImage} 
                  download="LUMIX_PRO_MASTER.jpg"
                  className="py-5 rounded-2xl bg-accent text-white font-bold uppercase tracking-widest hover:bg-accent/80 transition-all shadow-2xl shadow-accent/20 flex items-center justify-center gap-4 active:scale-[0.98] relative group overflow-hidden"
                 >
                   <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                   <Download size={20} className="group-hover:translate-y-0.5 transition-transform" />
                   <span className="text-sm">Save to Gallery</span>
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
