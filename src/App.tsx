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
  EyeOff,
  Hand,
  Timer,
  Wand2,
  SquareUser,
  SlidersHorizontal,
  Image as ImageIcon,
  Plus
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

const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  const words = text.split(' ');
  const lines = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + " " + word).width;
    if (width < maxWidth) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
};

type Mode = 'PHOTO' | 'PORTRAIT' | 'LANDSCAPE' | 'PRO' | 'PAS_PHOTO' | 'SCAN';
type FocusMode = 'FOCUS_SUBJECT' | 'BLUR_SUBJECT';
type PasPhotoSize = '2x3' | '3x4' | '4x6';

interface FilterPreset {
  id: string;
  name: string;
  css: string;
  icon: string;
}

const FILTER_PRESETS: FilterPreset[] = [
  { id: 'standard', name: 'Standard', css: '', icon: 'NATURAL' },
  { id: 'vibrant', name: 'Vibrant+', css: 'saturate(1.4) contrast(1.1) brightness(1.05)', icon: 'VIVID' },
  { id: 'portrait', name: 'Pro Portrait', css: 'saturate(1.1) brightness(1.02) contrast(0.98) sepia(0.05)', icon: 'SKIN' },
  { id: 'fuji', name: 'Fuji Astia', css: 'sepia(0.08) saturate(1.15) contrast(1.05) brightness(1.02)', icon: 'SOFT' },
  { id: 'kodak', name: 'Kodak Portra', css: 'sepia(0.12) saturate(0.98) contrast(1.1) brightness(1.03)', icon: 'WARM' },
  { id: 'leica', name: 'Leica B&W', css: 'grayscale(1) contrast(1.8) brightness(0.9)', icon: 'B&W' },
  { id: 'velvia', name: 'Velvia Nature', css: 'saturate(1.8) contrast(1.2) brightness(1.05)', icon: 'LANDSCAPE' },
  { id: 'urban', name: 'Urban Teal', css: 'hue-rotate(-15deg) saturate(1.25) contrast(1.1) brightness(1.02)', icon: 'CITY' },
  { id: 'golden', name: 'Golden Hour', css: 'sepia(0.25) saturate(1.4) brightness(1.08)', icon: 'SUNSET' },
  { id: 'cinematic', name: 'Cinematic', css: 'contrast(1.25) saturate(0.85) sepia(0.12) hue-rotate(8deg)', icon: 'MOVIE' },
  { id: 'pastel', name: 'Pure Pastel', css: 'brightness(1.15) contrast(0.85) saturate(0.75) sepia(0.05)', icon: 'LIGHT' },
  { id: 'noir', name: 'Noir Deep', css: 'grayscale(1) contrast(2.2) brightness(0.75)', icon: 'DARK' },
  { id: 'modern', name: 'Modern Clean', css: 'brightness(1.06) contrast(1.08) saturate(0.88)', icon: 'MINIMAL' },
  { id: 'analog', name: 'Retro Analog', css: 'sepia(0.3) contrast(0.9) brightness(1.12) saturate(1.1)', icon: 'FILM' },
  { id: 'ocean', name: 'Oceanic Blue', css: 'hue-rotate(10deg) saturate(1.1) brightness(1.02) contrast(1.08)', icon: 'SEA' },
  { id: 'matte', name: 'Matte Finish', css: 'contrast(0.75) brightness(1.12) saturate(0.92)', icon: 'PREMIUM' },
  { id: 'high_key', name: 'High Key Studio', css: 'brightness(1.3) contrast(0.8) saturate(0.8)', icon: 'STUDIO' },
  { id: 'dramatic', name: 'Dramatic Shadow', css: 'contrast(1.6) brightness(0.85) saturate(1.2)', icon: 'MOOD' },
  { id: 'vintage_70s', name: 'Vintage 70s', css: 'sepia(0.4) contrast(0.9) brightness(1.05) saturate(1.3)', icon: 'CLASSIC' },
  { id: 'cyber', name: 'Cyberpunk', css: 'hue-rotate(-40deg) saturate(1.6) contrast(1.3) brightness(1.1)', icon: 'NEON' },
  { id: 'ip_vivid', name: 'iPhone Vivid', css: 'saturate(1.6) contrast(1.15) brightness(1.05)', icon: 'IPHONE' },
  { id: 'ip_vivid_warm', name: 'iPhone Vivid Warm', css: 'saturate(1.6) contrast(1.15) brightness(1.05) sepia(0.1)', icon: 'IPHONE' },
  { id: 'ip_vivid_cool', name: 'iPhone Vivid Cool', css: 'saturate(1.6) contrast(1.15) brightness(1.05) hue-rotate(-5deg)', icon: 'IPHONE' },
  { id: 'ip_dramatic', name: 'iPhone Dramatic', css: 'contrast(1.4) saturate(0.8) brightness(0.95)', icon: 'IPHONE' },
  { id: 'ip_dramatic_warm', name: 'iPhone Dramatic Warm', css: 'contrast(1.4) saturate(0.8) brightness(0.95) sepia(0.15)', icon: 'IPHONE' },
  { id: 'ip_dramatic_cool', name: 'iPhone Dramatic Cool', css: 'contrast(1.4) saturate(0.8) brightness(0.95) hue-rotate(-8deg)', icon: 'IPHONE' },
  { id: 'ip_mono', name: 'iPhone Mono', css: 'grayscale(1) contrast(1.1) brightness(1.05)', icon: 'IPHONE' },
  { id: 'ip_silvertone', name: 'iPhone Silvertone', css: 'grayscale(1) contrast(1.3) brightness(1.1)', icon: 'IPHONE' },
  { id: 'ip_high_key_mono', name: 'iPhone High Key Mono', css: 'grayscale(1) brightness(1.4) contrast(0.9)', icon: 'IPHONE' },
  { id: 'ip_pro_portrait', name: 'iPhone Pro Studio', css: 'saturate(1.1) contrast(1.1) brightness(1.08) sepia(0.02)', icon: 'IPHONE PRO' },
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
      className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center p-12"
    >
      <div className="relative w-full h-full max-w-[80vw] max-h-[70vh]">
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_25px_rgba(255,77,0,0.4)]">
          {/* Detailed Human Silhouette instead of just dots */}
          <motion.path 
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            d="M50,15 C54,15 57,18 57,22 C57,26 54,29 50,29 C46,29 43,26 43,22 C43,18 46,15 50,15 M40,32 L60,32 C65,32 68,35 68,40 L65,65 C64,70 62,72 60,72 L55,72 L58,95 C58,98 56,100 53,100 L47,100 C44,100 42,98 42,95 L45,72 L40,72 C38,72 36,70 35,65 L32,40 C32,35 35,32 40,32 Z"
            fill="none"
            stroke="#FF4D00"
            strokeWidth="0.8"
            className="opacity-90"
          />
          
          {/* Enhanced points over the silhouette */}
          {pose.points.map((p, i) => (
            <motion.g key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.05 }}>
              <circle cx={p.x} cy={p.y} r="2.5" fill="#FF4D00" className="opacity-40 animate-pulse" />
              <circle cx={p.x} cy={p.y} r="1" fill="white" />
            </motion.g>
          ))}
          
          {/* Skeletal hint lines */}
          <polyline
            points={pose.points.map(p => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="#FF4D00"
            strokeWidth="0.4"
            opacity="0.3"
          />
        </svg>
        
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-accent/30 backdrop-blur-xl px-4 py-1.5 rounded-full border border-accent/50 flex flex-col items-center">
          <span className="text-[10px] text-white font-black uppercase tracking-[0.2em] whitespace-nowrap">{pose.name}</span>
          <span className="text-[7px] text-accent-foreground/70 uppercase font-bold tracking-tighter">Follow the Pose</span>
        </div>
      </div>
    </motion.div>
  );
}

function DocScanGuide({ tilt }: { tilt: { roll: number, pitch: number } }) {
  const isLevel = Math.abs(tilt.roll) < 2 && Math.abs(tilt.pitch) < 2;
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center p-12"
    >
      <div 
        className={`border-2 relative transition-all duration-500 w-full max-w-xs md:max-w-sm aspect-[1/1.414] ${isLevel ? 'border-green-500 bg-green-500/10 shadow-[0_0_50px_rgba(34,197,94,0.3)]' : 'border-white/40 bg-white/5 shadow-2xl'}`}
      >
        {/* Corner Brackets */}
        <div className="absolute top-0 left-0 w-8 h-8 border-l-4 border-t-4 border-accent" />
        <div className="absolute top-0 right-0 w-8 h-8 border-r-4 border-t-4 border-accent" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-l-4 border-b-4 border-accent" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-r-4 border-b-4 border-accent" />
        
        {/* Level Indicator */}
        <div className="absolute inset-0 flex items-center justify-center">
           <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-colors ${isLevel ? 'border-green-500 bg-green-500/20 shadow-lg' : 'border-white/20 text-white/20'}`}>
              <Maximize size={24} className={isLevel ? 'text-green-500 animate-pulse' : ''} />
           </div>
        </div>

        {/* Scan Status Label */}
        <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <div className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl backdrop-blur-xl transition-all ${isLevel ? 'bg-green-500 text-white scale-110' : 'bg-black/60 text-white border border-white/10'}`}>
            {isLevel ? 'System Ready' : 'Align for Scan'}
          </div>
          <span className="text-[8px] text-white/60 font-bold uppercase tracking-widest text-center max-w-[150px]">LMXP Document Engine Active • Anti-Blur Enabled</span>
        </div>
        
        {/* Decorative Grid Lines */}
        <div className="absolute inset-0 grid grid-cols-4 grid-rows-6 opacity-10">
          {[...Array(24)].map((_, i) => <div key={i} className="border-[0.5px] border-white" />)}
        </div>
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
  const [timerDelay, setTimerDelay] = useState(0); // 0, 3, 5, 10
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [autoAssist, setAutoAssist] = useState(false);
  const [hdEnhance, setHdEnhance] = useState<'OFF' | 'SMOOTH' | 'HD'>('OFF');
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewRotation, setPreviewRotation] = useState(0);
  const [poseIndex, setPoseIndex] = useState(0);
  const [torchOn, setTorchOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isUploadedImage, setIsUploadedImage] = useState(false);
  
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

  // AI Human Detection Auto-activation for iPhone Filters
  useEffect(() => {
    if (activeFilter.id.startsWith('ip_')) {
      setAiHumanDetection(true);
      if (focus === 0) setFocus(50); // Set default blur thickness for iPhone mode
    }
  }, [activeFilter.id]);

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
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`);
          const data = await res.json();
          
          if (data && data.address) {
            const { 
              house_number, road, 
              neighbourhood, suburb, village, hamlet, 
              city_district, city, town, municipality, 
              county, state, postcode 
            } = data.address;

            // 1. Format Jalan & Nomor (Standard Indonesian Style)
            let roadName = road || neighbourhood || "";
            if (roadName.toLowerCase().startsWith('jalan ')) {
              roadName = "Jl. " + roadName.substring(6);
            } else if (roadName && !roadName.toLowerCase().startsWith('jl.') && !roadName.toLowerCase().startsWith('jalan')) {
              roadName = "Jl. " + roadName;
            }
            const streetLine = house_number ? `${roadName} No.${house_number}` : roadName;
            
            // 2. Kelurahan / Desa
            // Usually 'village' or 'suburb' in ID. neighbourhood might be the most specific.
            const kelurahan = village || (neighbourhood !== road ? neighbourhood : "") || suburb || "";
            
            // 3. Kecamatan (City District)
            let kecamatan = city_district || "";
            if (kecamatan && !kecamatan.toLowerCase().includes('kecamatan') && !kecamatan.toLowerCase().startsWith('kec.')) {
              kecamatan = `Kec. ${kecamatan}`;
            }
            
            // 4. Kota / Kabupaten
            let kota = city || town || municipality || county || "";
            if (kota) {
              if (!kota.toLowerCase().startsWith('kota') && !kota.toLowerCase().startsWith('kab.')) {
                if (city || town) kota = `Kota ${kota}`;
                else if (county) kota = `Kab. ${kota}`;
              }
            }
            
            const mainParts = [streetLine, kelurahan, kecamatan, kota].filter(Boolean);
            const secondaryParts = [state, postcode].filter(Boolean);
            
            const formatted = mainParts.join(", ") + (secondaryParts.length ? ", " + secondaryParts.join(" ") : "");
            
            setLocationText(formatted && formatted.length > 10 ? formatted : data.display_name);
          } else {
            setLocationText(data.display_name || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
          }
        } catch {
          setLocationText(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        }
      },
      () => setLocationText("GPS Access Denied"),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }, []);

  useEffect(() => {
    let interval: any;
    if (timemarkEnabled) {
      fetchLocation();
      // Periodically refresh if enabled to ensure accuracy as user moves
      interval = setInterval(fetchLocation, 60000); 
    }
    return () => clearInterval(interval);
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
  const [iso, setIso] = useState(1); // 1 to 16 (ISO 100 to 1600)
  const [showIsoSlider, setShowIsoSlider] = useState(false);
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    // Frequency increases if Human Detection or Timer is on for faster response
    let frequency = 10000;
    if (aiHumanDetection) frequency = 4000;
    if (timerDelay > 0 && countdown === null) frequency = 2000; // Fast detection for palm gesture
    
    if ((autoAssist || aiHumanDetection || (timerDelay > 0 && countdown === null)) && !aiAnalyzing) {
      interval = setInterval(() => {
        analyzeScene();
      }, frequency);
    }
    return () => clearInterval(interval);
  }, [autoAssist, aiHumanDetection, aiAnalyzing, timerDelay, countdown]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsCapturing(true);
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    // Professional Landscape to Portrait correction
    // If user takes a LANDSCAPE shot, we rotate the pixels so the file is saved as Portrait (upright)
    const isLandscapeMode = mode === 'LANDSCAPE';
    const isSideways = video.videoWidth > video.videoHeight;
    
    let canvasWidth = video.videoWidth;
    let canvasHeight = video.videoHeight;
    let rotationNeeded = false;

    if (isLandscapeMode && isSideways) {
      canvasWidth = video.videoHeight;
      canvasHeight = video.videoWidth;
      rotationNeeded = true;
    }

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      if (rotationNeeded) {
        ctx.translate(canvasWidth / 2, canvasHeight / 2);
        ctx.rotate(Math.PI / 2);
        ctx.translate(-canvasHeight / 2, -canvasWidth / 2);
      }

      // Handle Mirroring for Front Camera Capture
      if (facingMode === 'user') {
        if (rotationNeeded) {
          // Adjust mirroring for rotated coordinates
          ctx.translate(0, video.videoHeight);
          ctx.scale(1, -1);
        } else {
          ctx.translate(video.videoWidth, 0);
          ctx.scale(-1, 1);
        }
      }

      // Selective Blur Logic
      const blurVal = focus > 0 ? focus / 4 : 0; 
      let baseFilters = `brightness(${1 + exposure / 100 + (iso - 1) / 20}) contrast(${1 + Math.abs(exposure) / 200}) hue-rotate(${wb * 0.5}deg) saturate(${1 + (iso - 1) / 50}) ${activeFilter.css}`;
      
      // Professional Scan Processing (Whiten background, darken text, remove mid-tone stains)
      if (mode === 'SCAN') {
        baseFilters = 'contrast(1.5) brightness(1.1) saturate(1.15)';
      }
      
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
            // High-precision Professional Blur Mask
            const bx = subjectBox.xmin * video.videoWidth / 1000;
            const by = subjectBox.ymin * video.videoHeight / 1000;
            const bw = (subjectBox.xmax - subjectBox.xmin) * video.videoWidth / 1000;
            const bh = (subjectBox.ymax - subjectBox.ymin) * video.videoHeight / 1000;
            
            // 1. Draw solid core
            mctx.fillStyle = 'white';
            const radius = Math.min(bw, bh) * 0.4;
            mctx.beginPath();
            mctx.roundRect(bx, by, bw, bh, radius);
            mctx.fill();

            // 2. Add exponential falloff blur for natural bokeh look
            mctx.globalCompositeOperation = 'source-over';
            mctx.filter = 'blur(40px)';
            mctx.drawImage(maskCanvas, 0, 0);
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
        // Reset transformation matrix so text is not mirrored when facingMode is 'user'
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        // Scale factor for responsive timemark
        const scale = video.videoWidth / 1200;
        const sFontSize = Math.max(12, timemarkFontSize * scale);
        const margin = 40 * scale;
        const maxWidth = video.videoWidth - (margin * 2);

        ctx.fillStyle = 'white';
        ctx.shadowBlur = 6 * scale;
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
        const addressText = timemarkManualText ? `${timemarkManualText} • ${displayLocation}` : displayLocation;

        // Draw Address first (bottom-most)
        ctx.font = `${Math.round(sFontSize * 0.75)}px "JetBrains Mono", monospace`;
        const addressLines = wrapText(ctx, addressText, maxWidth);
        
        let currentY = video.videoHeight - (sFontSize * 1.875);
        addressLines.reverse().forEach((line, idx) => {
          ctx.fillText(line, margin, currentY - (idx * sFontSize * 0.85));
        });

        // Draw Timestamp above address
        ctx.font = `bold ${sFontSize}px "JetBrains Mono", monospace`;
        const timestampY = currentY - (addressLines.length * sFontSize * 0.85) - (sFontSize * 0.5);
        ctx.fillText(timestamp, margin, timestampY);
      }

      setCapturedImage(canvas.toDataURL('image/jpeg', 0.95)); // High Quality
    }
    
    setTimeout(() => setIsCapturing(false), 300);
  }, [timemarkEnabled, timemarkManualText, locationText, useManualDate, manualDateValue, useManualTime, manualTimeValue, useManualLocation, manualLocationText, timemarkFontSize, exposure, wb, iso, focus, focusAreaSize, focusPoint, activeFilter, facingMode, focusMode, aiHumanDetection, subjectBox]);

  const handleDownload = async () => {
    if (!capturedImage) return;

    const img = new Image();
    img.src = capturedImage;
    await new Promise(resolve => img.onload = resolve);

    const canvas = document.createElement('canvas');
    const isRotated90or270 = previewRotation === 90 || previewRotation === 270;
    
    canvas.width = isRotated90or270 ? img.height : img.width;
    canvas.height = isRotated90or270 ? img.width : img.height;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (hdEnhance === 'HD') {
        ctx.filter = 'contrast(1.15) saturate(1.1) brightness(1.05)';
      } else if (hdEnhance === 'SMOOTH') {
        ctx.filter = 'saturate(1.08) brightness(1.08) contrast(0.92)';
      }
      
      // Apply rotation
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((previewRotation * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/jpeg', 0.98);
      link.download = `LUMIX_PRO_MASTER_${Date.now()}.jpg`;
      link.click();
    }
  };

  // Handle Timer Countdown
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      capturePhoto();
      setCountdown(null);
      return;
    }
    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown, capturePhoto]);
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
                       2. Recommend the best filter ID from available: standard, vibrant, ip_vivid, ip_vivid_warm, ip_dramatic, ip_pro_portrait, cinematic, noir.
                       3. If humans are present, provide ONE main bounding box [ymin, xmin, ymax, xmax] in 0-1000 normalized coordinates for the primary person.
                       4. Palm / Hand Trigger: Look specifically for a human hand with the palm open and facing towards the camera (the "Show Palm" gesture). If detected, set "palm_detected" to true.
                       5. Based on light and subject, suggest 2 professional photography tips.
                       
                       Return JSON strictly: { 
                         "objects": [], 
                         "tips": [], 
                         "recommended_filter_id": "string",
                         "subject_box": [ymin, xmin, ymax, xmax] | null,
                         "palm_detected": boolean
                       }` },
              { inlineData: { mimeType: "image/jpeg", data: base64Image } }
            ]
          }
        ],
        config: { responseMimeType: "application/json" }
      });

      const data = JSON.parse(response.text || '{}');
      setAiFeedback(data);
      
      // Palm Trigger for Countdown
      if (data.palm_detected && timerDelay > 0 && countdown === null) {
        setCountdown(timerDelay);
      }
      
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
    brightness(${1 + exposure / 100 + (iso - 1) / 20})
    contrast(${1 + Math.abs(exposure) / 200})
    hue-rotate(${wb * 0.5}deg)
    saturate(${1 + (iso - 1) / 50})
    ${mode === 'SCAN' ? 'contrast(1.5) brightness(1.1) saturate(1.15)' : activeFilter.css}
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

  const handleShutterClick = () => {
    if (timerDelay > 0 && countdown === null) {
      setCountdown(timerDelay);
    } else {
      capturePhoto();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      setCapturedImage(dataUrl);
      setIsUploadedImage(true);
      setPreviewZoom(1);
      setPreviewRotation(0);
    };
    reader.readAsDataURL(file);
  };

  const applyManualTimemark = async () => {
    if (!capturedImage) return;
    
    // Process image to apply timemark
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = capturedImage;
    await new Promise(resolve => img.onload = resolve);
    
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(img, 0, 0);
    
    // Scale factor
    const scale = img.width / 1200;
    const sFontSize = Math.max(12, timemarkFontSize * scale);
    const margin = 40 * scale;
    const maxWidth = canvas.width - (margin * 2);
    
    ctx.fillStyle = 'white';
    ctx.shadowBlur = 4 * scale;
    ctx.shadowColor = 'black';
    ctx.textAlign = 'left';
    
    const daysIndo = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const d = useManualDate ? new Date(`${manualDateValue}T00:00:00`) : new Date();
    const formattedDate = `${daysIndo[d.getDay()]}, ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    
    let timeString = "";
    if (useManualTime) {
      timeString = manualTimeValue;
    } else if (!useManualDate) {
      const now = new Date();
      timeString = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    }
    
    const timestamp = formattedDate + (timeString ? ` • ${timeString}` : "");
    let displayLocation = useManualLocation ? manualLocationText : locationText;
    const addressText = timemarkManualText ? `${timemarkManualText} • ${displayLocation}` : displayLocation;
    
    // Draw Address
    ctx.font = `${Math.round(sFontSize * 0.75)}px "JetBrains Mono", monospace`;
    const addressLines = wrapText(ctx, addressText, maxWidth);
    
    let currentY = canvas.height - (sFontSize * 1.875);
    addressLines.reverse().forEach((line, idx) => {
      ctx.fillText(line, margin, currentY - (idx * sFontSize * 0.85));
    });

    // Draw Timestamp
    ctx.font = `bold ${sFontSize}px "JetBrains Mono", monospace`;
    const timestampY = currentY - (addressLines.length * sFontSize * 0.85) - (sFontSize * 0.5);
    ctx.fillText(timestamp, margin, timestampY);
    
    setCapturedImage(canvas.toDataURL('image/jpeg', 0.95));
  };

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
              onClick={() => setTimerDelay(timerDelay === 0 ? 3 : timerDelay === 3 ? 5 : timerDelay === 5 ? 10 : 0)}
              className={`p-1.5 transition-colors flex items-center gap-1.5 ${timerDelay > 0 ? 'text-accent' : 'hover:text-white opacity-50 hover:opacity-100'}`}
              title="Timer for Hand Trigger"
            >
              <Timer size={16} />
              {timerDelay > 0 && <span className="text-[10px] font-bold">{timerDelay}s</span>}
            </button>
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
            <button onClick={() => setShowGrid(!showGrid)} className={`p-1.5 transition-colors relative ${showGrid ? 'text-accent' : 'hover:text-white'}`} title="Grid">
              <Grid3X3 size={16} className="md:w-[18px] md:h-[18px]" />
              {showGrid && <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-green-500 rounded-full border border-black z-10" />}
            </button>
            <button className="p-1.5 hover:text-white transition-colors relative" onClick={() => setShowSettings(!showSettings)} title="Settings">
              <Settings size={16} className="md:w-[18px] md:h-[18px]" />
              {(timemarkEnabled || aiHumanDetection) && <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-green-500 rounded-full border border-black z-10" />}
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
          {/* Top-Right Control Actions */}
          <div className="absolute top-4 right-4 z-[45] flex flex-col gap-2">
            <AnimatePresence>
              {(aiHumanDetection || activeFilter.id.startsWith('ip_')) && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 20, x: 20 }}
                  className="px-3 py-1 bg-accent/90 backdrop-blur-xl rounded-full border border-white/20 flex items-center gap-2 shadow-xl"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  <span className="text-[9px] font-black text-white uppercase tracking-[0.2em]">
                    {activeFilter.id.startsWith('ip_') ? 'iPhone Pro Portrait' : 'AI Subject Tracking'}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Top-Left Control Actions */}
          <div className="absolute top-6 left-6 z-[45] flex flex-col gap-4">
            {capturedImage && (
              <div 
                className="w-16 h-16 rounded-xl border-2 border-white/20 overflow-hidden shadow-2xl hover:scale-105 transition-transform cursor-pointer" 
                onClick={() => { setShowSettings(true); setSettingsTab('TIMEMARK'); }}
              >
                <img src={capturedImage} className="w-full h-full object-cover" />
              </div>
            )}
            
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => { e.stopPropagation(); fetchLocation(); }}
              className="p-3 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-full text-white hover:border-accent/40 shadow-2xl group flex items-center gap-2 self-start"
              title="Refresh GPS Address"
            >
              <MapPin size={18} className={timemarkEnabled ? "text-accent" : "text-white/40"} />
              <div className="flex flex-col items-start overflow-hidden">
                <span className="text-[7px] font-black uppercase tracking-widest leading-none text-accent mb-0.5">GPS Sync</span>
                <span className="text-[9px] font-bold uppercase tracking-tight hidden group-hover:block whitespace-nowrap">Refresh Location</span>
              </div>
            </motion.button>
          </div>

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

          {/* Professional Focus Tracking Frame */}
          {aiHumanDetection && subjectBox && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                left: `${subjectBox.xmin/10}%`,
                top: `${subjectBox.ymin/10}%`,
                width: `${(subjectBox.xmax - subjectBox.xmin)/10}%`,
                height: `${(subjectBox.ymax - subjectBox.ymin)/10}%`
              }}
              className="absolute border-2 border-accent/60 z-40 pointer-events-none transition-all duration-300"
            >
              {/* Corner Accents */}
              <div className="absolute -top-1 -left-1 w-4 h-4 border-l-4 border-t-4 border-accent" />
              <div className="absolute -top-1 -right-1 w-4 h-4 border-r-4 border-t-4 border-accent" />
              <div className="absolute -bottom-1 -left-1 w-4 h-4 border-l-4 border-b-4 border-accent" />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 border-r-4 border-b-4 border-accent" />
              
              <div className="absolute top-2 left-2 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />
                <span className="text-[8px] text-accent font-black uppercase tracking-[0.2em] bg-black/60 px-1 py-0.5 rounded">Tracking Locked</span>
              </div>
            </motion.div>
          )}

          {/* Tap-to-Focus Ring & Depth Grid */}
          <AnimatePresence>
            {showFocusRing && (
              <>
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.15 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 pointer-events-none grid grid-cols-6 grid-rows-6"
                >
                  {[...Array(35)].map((_, i) => (
                    <div key={i} className="border-[0.5px] border-accent/20" />
                  ))}
                </motion.div>
                <motion.div 
                  initial={{ scale: 2, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{ left: `${focusPoint.x}%`, top: `${focusPoint.y}%` }}
                  className="absolute w-20 h-20 border border-accent/40 rounded-full -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none flex items-center justify-center"
                >
                  <div className="w-16 h-16 border-2 border-accent rounded-full" />
                  <div className="absolute inset-0 border border-accent/20 rounded-full animate-ping" />
                  
                  {/* Focus Metadata */}
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <span className="text-[8px] text-accent font-mono font-bold uppercase py-0.5 px-1 bg-black/40">AF-S LOCK {(focus/10).toFixed(1)}m</span>
                  </div>
                </motion.div>
              </>
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
                <button 
                  onClick={() => setShowIsoSlider(!showIsoSlider)}
                  className="cursor-pointer active:scale-95 transition-transform"
                  title="Adjust ISO Sensitivity"
                >
                  <ControlCard label="ISO" value={(iso * 100).toString()} active={showIsoSlider} />
                </button>
                <ControlCard label="EV" value={exposure > 0 ? `+${exposure/100}` : (exposure/100).toString()} active={exposure !== 0} />
                <ControlCard label="WB" value={wb >= 0 ? `${5200 + wb*10}K` : `${3200 + wb*10}K`} active={wb !== 0} />
                <ControlCard label="FCS" value={focus === 0 ? "AF" : (focus/10).toFixed(1)} active={focus !== 0} />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showIsoSlider && uiVisible && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute right-[85px] top-1/2 -translate-y-1/2 h-[300px] bg-panel/80 backdrop-blur-xl border border-ui-border rounded-3xl p-4 flex flex-col items-center gap-4 z-50 shadow-2xl"
              >
                <div className="flex flex-col items-center gap-1">
                  <SlidersHorizontal size={14} className="text-accent" />
                  <span className="text-[10px] font-bold text-white leading-none">ISO {iso * 100}</span>
                </div>
                
                <div className="relative flex-1 w-10 flex items-center justify-center">
                  <input 
                    type="range"
                    min={1}
                    max={16}
                    step={1}
                    value={iso}
                    onChange={(e) => setIso(Number(e.target.value))}
                    className="absolute w-[220px] -rotate-90 bg-[#333] appearance-none h-1.5 rounded-full accent-accent cursor-pointer"
                    style={{ transformOrigin: 'center' }}
                  />
                </div>
                
                <button 
                  onClick={() => setShowIsoSlider(false)}
                  className="p-1.5 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-colors"
                >
                  <X size={12} className="text-white" />
                </button>
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
            {mode === 'SCAN' && (
              <DocScanGuide tilt={tilt} />
            )}
            {showPoseDots && (
              <DotSilhouette poseIndex={recommendedPoseIdx ?? 0} />
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

          {/* Captured Preview (Small thumbnail) - MOVED TO TOP-LEFT GROUP */}

          {/* Countdown Indicator */}
          {countdown !== null && (
            <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none bg-black/20">
              <motion.span 
                key={countdown}
                initial={{ scale: 2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                className="text-8xl md:text-[12rem] font-black text-white drop-shadow-[0_0_30px_rgba(0,0,0,0.5)]"
              >
                {countdown}
              </motion.span>
            </div>
          )}

          {/* Palm Trigger Indicator */}
          {aiFeedback?.palm_detected && timerDelay > 0 && countdown !== null && (
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="absolute top-6 right-6 z-40 bg-accent text-white px-4 py-2 rounded-full flex items-center gap-3 shadow-2xl border border-white/20"
            >
              <Hand size={16} className="animate-bounce" />
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest leading-none">Palm Detected</span>
                <span className="text-[8px] font-bold opacity-80 uppercase tracking-tighter">Starting Countdown...</span>
              </div>
            </motion.div>
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
      <div className="bg-[#111]/90 backdrop-blur-xl border-t border-ui-border z-30 overflow-hidden transition-all duration-500 relative">
        <div className="flex flex-col md:grid md:grid-cols-[1.2fr,2fr,0.8fr] items-center px-4 md:px-10 py-2 gap-3">
          
          {/* Left: Controls & Sliders */}
          <div className="flex flex-col gap-3">
            <AnimatePresence>
              {uiVisible && (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="w-full space-y-1.5 max-w-[300px] md:max-w-none"
                >
                  <div className="flex items-center justify-between text-[9px] font-bold text-text-dim uppercase tracking-wider">
                    <div className="flex items-center gap-1.5">
                      <Sun size={11} className="text-accent" />
                      <span>Background Blur</span>
                    </div>
                    <span className="text-white italic">{focus === 0 ? "OFF" : `f/${(22 - focus/5).toFixed(1)}`}</span>
                  </div>
                  <div className="relative group flex items-center h-6">
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

            <AnimatePresence>
              {uiVisible && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3"
                >
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2.5 rounded-full border border-white/10 hover:border-accent transition-all bg-white/5 active:scale-90 flex items-center gap-2 pr-4"
                    title="Upload Photo for Timemark"
                  >
                    <ImageIcon size={16} className="text-white" />
                    <span className="text-[8px] font-black text-white uppercase tracking-widest">Gallery</span>
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleImageUpload} 
                  />

                  <button 
                    onClick={() => setAutoAssist(!autoAssist)}
                    className={`p-2.5 rounded-full border transition-all relative flex items-center gap-2 pr-4 ${autoAssist ? 'border-accent bg-accent/10' : 'border-white/10 hover:border-accent'}`}
                  >
                    <Target size={16} className={autoAssist ? 'text-accent' : 'text-white'} />
                    <span className={`text-[8px] font-black uppercase tracking-widest ${autoAssist ? 'text-accent' : 'text-white'}`}>AI Focus</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Center: Modes + Shutter */}
          <div className="flex flex-col items-center gap-2 pb-1">
            <AnimatePresence>
              {uiVisible && (
                <div className="relative w-full max-w-[90vw] overflow-hidden">
                  {/* Fading Edges for Mobile Scroll */}
                  <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-bg to-transparent z-10 pointer-events-none md:hidden" />
                  <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-bg to-transparent z-10 pointer-events-none md:hidden" />
                  
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="flex gap-4 md:gap-8 text-[9px] md:text-[11px] font-bold tracking-[0.1em] uppercase overflow-x-auto no-scrollbar justify-start md:justify-center px-8"
                  >
                    {(['PHOTO', 'PORTRAIT', 'LANDSCAPE', 'PRO', 'PAS_PHOTO', 'SCAN'] as Mode[]).map(m => (
                      <button 
                        key={m}
                        onClick={() => {
                          setMode(m);
                        }}
                        className={`relative transition-all pt-1 pb-2 shrink-0 ${mode === m ? 'text-white' : 'text-text-dim hover:text-white'}`}
                      >
                        <span className="whitespace-nowrap">{m.replace('_', ' ')}</span>
                        {mode === m && (
                          <motion.div layoutId="modeDot" className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent" />
                        )}
                      </button>
                    ))}
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Sub-selectors for Pas Photo */}
            <AnimatePresence>
              {uiVisible && (
                <div className="h-4 flex items-center justify-center">
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
                          className={`text-[8px] font-bold px-2 py-0.5 rounded-md transition-colors ${pasPhotoSize === s ? 'bg-accent text-white' : 'text-text-dim hover:text-white'}`}
                        >
                          {s}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </div>
              )}
            </AnimatePresence>

            <div className="flex flex-col items-center gap-4">
              <button 
                onClick={handleShutterClick}
                className={`w-20 h-20 md:w-24 md:h-24 rounded-full border-[4px] md:border-[5px] border-white p-1.5 hover:scale-105 active:scale-90 transition-all group relative ${!uiVisible ? 'ring-8 ring-accent/30' : ''}`}
              >
                <div className="w-full h-full rounded-full bg-white group-hover:bg-white/90 shadow-2xl transition-all" />
                <div className="absolute inset-0 rounded-full border border-white/20 animate-pulse scale-110 pointer-events-none" />
              </button>

              <AnimatePresence>
                {uiVisible && (
                  <motion.button 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    onClick={toggleCamera}
                    className="p-3 rounded-full border border-white/10 hover:border-white transition-colors flex items-center gap-2"
                  >
                    <RotateCcw size={16} className={facingMode === 'user' ? 'rotate-180 text-accent' : 'text-white'} />
                    <span className="text-[8px] font-black text-white uppercase tracking-widest">Flip Cam</span>
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
                className="flex md:flex-col items-center justify-end w-full gap-3 text-right mt-1 md:mt-0"
              >
                 <div className="flex flex-col items-center md:items-end gap-3">
                   <div className="flex items-center gap-3">
                     <button 
                       onClick={() => {
                         setShowPoseDots(!showPoseDots);
                         if (!showPoseDots) analyzeScene(); 
                       }}
                       className={`p-3 rounded-xl border transition-all relative ${showPoseDots ? 'border-accent bg-accent/20 shadow-[0_0_15px_rgba(34,197,94,0.2)]' : 'border-white/10 bg-white/5 hover:border-accent'}`}
                       title="AI Pose Recommendation"
                     >
                       {showPoseDots && (
                         <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border border-[#111] animate-pulse" />
                       )}
                       <Info size={18} className={showPoseDots ? 'text-accent' : 'text-white'} />
                     </button>
                     
                     <button 
                       onClick={() => setPoseIndex((poseIndex + 1) % poses.length)}
                       className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-accent transition-all group relative"
                       title="Switch Pose Guide"
                     >
                       <SquareUser size={18} className="text-white group-hover:text-accent" />
                     </button>
                   </div>
                   
                   <div className="hidden md:flex flex-col items-end">
                     <span className="text-[8px] text-text-dim font-black uppercase tracking-widest whitespace-nowrap">Neural Pose Guide</span>
                     <span className="text-[10px] text-white font-mono leading-none border-b border-accent/40 pb-0.5">{poses[poseIndex].name}</span>
                   </div>
                 </div>
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
                 <div className="flex-1 relative rounded-3xl overflow-hidden shadow-[0_0_80px_rgba(255,77,0,0.15)] border border-white/10 group bg-[#080808] flex items-center justify-center cursor-grab active:cursor-grabbing">
                   <motion.img 
                      drag={previewZoom > 1}
                      dragConstraints={{ left: -1000, right: 1000, top: -1000, bottom: 1000 }}
                      src={capturedImage} 
                      className="max-w-full max-h-full object-contain" 
                      animate={{ 
                        scale: previewZoom,
                        rotate: previewRotation
                      }}
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      style={{ 
                        filter: hdEnhance === 'HD' 
                          ? 'contrast(1.2) saturate(1.1) brightness(1.05)' 
                          : hdEnhance === 'SMOOTH' 
                          ? 'saturate(1.08) brightness(1.1) contrast(0.9) blur(0.5px)' 
                          : 'none' 
                      }}
                      alt="Captured" 
                      referrerPolicy="no-referrer" />

                    {isUploadedImage && (
                      <div className="absolute top-6 right-6 flex flex-col gap-2 z-[110]">
                        <button 
                          onClick={applyManualTimemark}
                          className="px-6 py-3 bg-accent shadow-[0_0_20px_rgba(255,77,0,0.4)] border border-accent rounded-xl text-xs md:text-sm uppercase font-black tracking-[0.2em] text-white flex items-center gap-3 hover:bg-accent/90 transition-all active:scale-95 animate-in fade-in zoom-in duration-300"
                        >
                          <Clock size={18} />
                          Give Timemark Manual
                        </button>
                      </div>
                    )}
                 
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
               <div className="flex flex-col md:flex-row gap-3 pb-4">
                 <button 
                  onClick={() => { 
                    setCapturedImage(null); 
                    setHdEnhance('OFF'); 
                    setPreviewZoom(1); 
                    setPreviewRotation(0); 
                    setIsUploadedImage(false);
                    setIsUploadedImage(false);
                  }}
                  className="flex-1 py-4 md:py-6 rounded-2xl bg-white/5 border border-white/10 text-white font-bold uppercase tracking-[0.2em] hover:bg-white/10 transition-all flex items-center justify-center gap-3 backdrop-blur-xl group active:scale-[0.98]"
                 >
                   <RotateCcw size={18} className="group-hover:-rotate-45 transition-transform" />
                   <span className="text-[10px] md:text-xs">Retake</span>
                 </button>

                 <button 
                  onClick={() => setHdEnhance(prev => prev === 'OFF' ? 'HD' : prev === 'HD' ? 'SMOOTH' : 'OFF')}
                  className={`flex-1 py-4 md:py-6 rounded-2xl border transition-all flex items-center justify-center gap-3 backdrop-blur-xl group active:scale-[0.98] ${hdEnhance !== 'OFF' ? 'bg-accent/20 border-accent text-accent' : 'bg-white/5 border-white/10 text-white hover:border-accent/50'}`}
                 >
                   <Wand2 size={18} className={hdEnhance !== 'OFF' ? 'animate-pulse' : ''} />
                   <span className="text-[10px] md:text-xs">{hdEnhance === 'OFF' ? 'HD Filter' : hdEnhance === 'HD' ? 'Ultra HD' : 'Smooth Clear'}</span>
                 </button>

                 <button 
                  onClick={() => setPreviewRotation(prev => (prev + 90) % 360)}
                  className="flex-1 py-4 md:py-6 rounded-2xl bg-white/5 border border-white/10 text-white font-bold uppercase tracking-[0.2em] hover:bg-white/10 transition-all flex items-center justify-center gap-3 backdrop-blur-xl group active:scale-[0.98]"
                 >
                   <RotateCw size={18} className="group-hover:rotate-90 transition-transform" />
                   <span className="text-[10px] md:text-xs">Rotate</span>
                 </button>

                 <div className="flex-[1.5] flex flex-col gap-2">
                    <div className="flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-xl">
                      <Maximize size={16} className="text-accent" />
                      <input 
                        type="range" 
                        min={1} 
                        max={3} 
                        step={0.1}
                        value={previewZoom}
                        onChange={(e) => setPreviewZoom(Number(e.target.value))}
                        className="flex-1 h-1 bg-white/10 appearance-none rounded-full accent-accent cursor-pointer"
                      />
                      <span className="text-[10px] text-white font-mono min-w-[35px] text-right">{Math.round(previewZoom * 100)}%</span>
                    </div>
                    <button 
                      onClick={handleDownload}
                      className="w-full py-4 md:py-6 rounded-2xl bg-accent text-white font-bold uppercase tracking-[0.2em] hover:bg-accent/80 transition-all shadow-2xl shadow-accent/20 flex items-center justify-center gap-3 active:scale-[0.98] relative group overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                      <Download size={18} className="group-hover:translate-y-0.5 transition-transform" />
                      <span className="text-[10px] md:text-xs font-black">Save Photo</span>
                    </button>
                 </div>
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
