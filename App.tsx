
import React, { useState, useRef, useEffect } from 'react';
import { Upload, Film, FileType, Settings, Play, Download, CheckCircle, Eye, Loader2, RefreshCcw, AlertCircle, HardDrive, Zap, Type, Palette, Layout, AlignVerticalJustifyCenter, Wand2, Trash2, Save, Plus, X } from 'lucide-react';
import { Logo } from './components/Logo';
import { CloudButton } from './components/CloudButton';
import { ffmpegService } from './services/ffmpegService';
import { AppStep, CloudProvider, SubtitleStyle } from './types';

const PRESETS: { name: string; style: SubtitleStyle }[] = [
  {
    name: 'Classic Yellow',
    style: {
      fontSize: 24,
      primaryColor: '#FFFF00',
      outlineColor: '#000000',
      outlineWidth: 2,
      marginV: 30,
      alignment: 2,
      bold: true,
      italic: false,
    }
  },
  {
    name: 'Modern White',
    style: {
      fontSize: 24,
      primaryColor: '#FFFFFF',
      outlineColor: '#000000',
      outlineWidth: 1.5,
      marginV: 35,
      alignment: 2,
      bold: false,
      italic: false,
    }
  },
  {
    name: 'Neon Blue',
    style: {
      fontSize: 26,
      primaryColor: '#00FFFF',
      outlineColor: '#000000',
      outlineWidth: 2,
      marginV: 30,
      alignment: 2,
      bold: true,
      italic: false,
    }
  },
  {
    name: 'Minimalist',
    style: {
      fontSize: 18,
      primaryColor: '#E0E0E0',
      outlineColor: '#111111',
      outlineWidth: 0.5,
      marginV: 25,
      alignment: 2,
      bold: false,
      italic: true,
    }
  }
];

const App: React.FC = () => {
  // State
  const [step, setStep] = useState<AppStep>(AppStep.UPLOAD);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [subFile, setSubFile] = useState<File | null>(null);
  const [fps, setFps] = useState<number>(30);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  
  // Subtitle Style State
  const [subStyle, setSubStyle] = useState<SubtitleStyle>(PRESETS[0].style);
  
  // Custom Presets State
  const [customPresets, setCustomPresets] = useState<{ name: string; style: SubtitleStyle }[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  
  // Processing State
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logMessage, setLogMessage] = useState<string>('Ready to initialize engine...');
  const [error, setError] = useState<string | null>(null);

  // Preview State
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewGenerating, setIsPreviewGenerating] = useState(false);

  // Refs
  const videoInputRef = useRef<HTMLInputElement>(null);
  const subInputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto scroll terminal
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logMessage]);

  useEffect(() => {
    // Cleanup preview URL on unmount
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Load saved presets on mount
  useEffect(() => {
    const saved = localStorage.getItem('javth_custom_presets');
    if (saved) {
      try {
        setCustomPresets(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved presets", e);
      }
    }
  }, []);

  // Invalidate preview when settings change
  useEffect(() => {
    if (previewUrl) {
       // Optional: setPreviewUrl(null); 
    }
  }, [fps, subFile, subStyle]);

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setVideoFile(e.target.files[0]);
      setError(null);
      setPreviewUrl(null); // Clear previous preview
    }
  };

  const handleSubUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSubFile(e.target.files[0]);
      setError(null);
      setPreviewUrl(null); // Clear previous preview
    }
  };

  const handleCloudClick = (provider: CloudProvider) => {
    // Simulate cloud integration by opening file picker
    setLogMessage(`Requesting file from ${provider}...`);
    videoInputRef.current?.click();
  };

  const handleSavePreset = () => {
    if (!newPresetName.trim()) return;
    const newPreset = { name: newPresetName, style: { ...subStyle } };
    const updated = [...customPresets, newPreset];
    setCustomPresets(updated);
    localStorage.setItem('javth_custom_presets', JSON.stringify(updated));
    setIsSaving(false);
    setNewPresetName('');
  };

  const handleDeletePreset = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this preset?")) {
      const updated = customPresets.filter((_, i) => i !== index);
      setCustomPresets(updated);
      localStorage.setItem('javth_custom_presets', JSON.stringify(updated));
    }
  };

  const generatePreview = async () => {
    if (!videoFile) return;
    
    setIsPreviewGenerating(true);
    setError(null);
    
    // Cleanup old preview
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);

    try {
      // Use the service to generate a 5s preview
      const url = await ffmpegService.createPreview(videoFile, subFile, fps, subStyle);
      setPreviewUrl(url);
    } catch (err: any) {
      console.error(err);
      setError("Preview failed. The file format might be incompatible with partial reading.");
    } finally {
      setIsPreviewGenerating(false);
    }
  };

  const startProcessing = async () => {
    if (!videoFile) return;

    setStep(AppStep.PROCESSING);
    setIsProcessing(true);
    setProgress(0);
    setError(null);

    try {
      ffmpegService.setLogger((msg) => {
        setLogMessage(msg);
      });
      
      ffmpegService.setProgress((p) => {
        setProgress(p);
      });

      const url = await ffmpegService.processVideo(
        videoFile,
        subFile,
        fps,
        `JAV_TH_Processed_${Date.now()}.mp4`,
        subStyle
      );

      setOutputUrl(url);
      setStep(AppStep.COMPLETED);
    } catch (err: any) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      setStep(AppStep.SETTINGS); // Go back
    } finally {
      setIsProcessing(false);
    }
  };

  const resetApp = () => {
    setStep(AppStep.UPLOAD);
    setVideoFile(null);
    setSubFile(null);
    setOutputUrl(null);
    setPreviewUrl(null);
    setProgress(0);
    setError(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#050505] text-white">
      {/* Dynamic Background Pattern */}
      <div className="fixed inset-0 opacity-10 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #333 1px, transparent 0)', backgroundSize: '24px 24px' }}>
      </div>

      {/* Header */}
      <header className="bg-jav-dark/95 backdrop-blur-md border-b border-jav-red/20 sticky top-0 z-50 shadow-lg shadow-red-900/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-24 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-4">
             <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-jav-red/10 rounded border border-jav-red/20 text-jav-red text-xs font-bold tracking-widest uppercase">
                <Zap size={14} fill="currentColor" />
                <span>Turbo Engine Active</span>
             </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow container mx-auto px-4 py-8 relative z-10">
        
        {/* Progress Stepper */}
        <div className="max-w-4xl mx-auto mb-12">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 top-1/2 w-full h-1 bg-jav-gray -z-10 rounded-full"></div>
            <div className={`absolute left-0 top-1/2 h-1 bg-gradient-to-r from-jav-red to-jav-yellow -z-10 rounded-full transition-all duration-700 ease-out`} 
              style={{ width: step === AppStep.UPLOAD ? '15%' : step === AppStep.SETTINGS ? '50%' : step === AppStep.PROCESSING ? '80%' : '100%' }}>
            </div>
            
            {[
              { id: AppStep.UPLOAD, icon: Upload, label: 'FILE UPLOAD' },
              { id: AppStep.SETTINGS, icon: Settings, label: 'SETTINGS' },
              { id: AppStep.PROCESSING, icon: Play, label: 'RENDERING' },
              { id: AppStep.COMPLETED, icon: Download, label: 'FINISH' }
            ].map((s, idx) => (
              <div key={s.id} className="flex flex-col items-center group">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border-2 transform transition-all duration-300
                  ${Object.values(AppStep).indexOf(step) >= idx 
                    ? 'bg-jav-red border-jav-red text-white rotate-3 scale-110 shadow-[0_0_20px_rgba(255,0,0,0.4)]' 
                    : 'bg-jav-black border-gray-700 text-gray-600 group-hover:border-gray-500'}`}>
                  <s.icon size={20} strokeWidth={2.5} />
                </div>
                <span className={`text-[10px] mt-3 font-bold tracking-widest ${Object.values(AppStep).indexOf(step) >= idx ? 'text-white' : 'text-gray-600'}`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* STEP 1: UPLOAD */}
        {step === AppStep.UPLOAD && (
          <div className="max-w-5xl mx-auto animate-fade-in">
            <div className="bg-jav-black border border-jav-gray rounded-3xl p-1 shadow-2xl relative overflow-hidden group">
               <div className="bg-jav-dark rounded-[20px] p-8 sm:p-12 relative z-10 h-full">
                  
                  <div className="flex flex-col md:flex-row items-start justify-between mb-8">
                     <div>
                        <h2 className="text-3xl font-black text-white italic uppercase tracking-tight flex items-center gap-3">
                           <Film className="text-jav-red" size={32} /> 
                           Source Media
                        </h2>
                        <p className="text-gray-500 mt-2 text-sm max-w-md">
                           Support for large files (up to 15GB). Files are processed locally and securely using WASM technology.
                        </p>
                     </div>
                     <div className="mt-4 md:mt-0 px-4 py-2 bg-jav-yellow/10 border border-jav-yellow/20 rounded-lg">
                        <span className="text-jav-yellow text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                           <HardDrive size={14} /> High Capacity Mode
                        </span>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Video Upload Area */}
                    <div 
                      className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer min-h-[300px] relative overflow-hidden
                        ${videoFile 
                           ? 'border-jav-red bg-gradient-to-br from-jav-red/10 to-transparent' 
                           : 'border-gray-800 hover:border-jav-red/50 hover:bg-jav-gray/30'}`}
                      onClick={() => videoInputRef.current?.click()}
                    >
                      <input 
                        type="file" 
                        accept="video/mp4,video/x-m4v,video/*" 
                        className="hidden" 
                        ref={videoInputRef} 
                        onChange={handleVideoUpload}
                      />
                      
                      {videoFile ? (
                        <div className="relative z-10 w-full">
                          <div className="w-20 h-20 bg-jav-red rounded-2xl flex items-center justify-center mb-6 mx-auto shadow-lg shadow-red-900/30">
                             <Film className="w-10 h-10 text-white" />
                          </div>
                          <p className="font-bold text-xl text-white break-words line-clamp-2">{videoFile.name}</p>
                          <div className="inline-block px-3 py-1 bg-black/50 rounded-full mt-3 border border-white/10">
                            <p className="text-sm text-jav-yellow font-mono">{(videoFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                          </div>
                          <button className="absolute top-0 right-0 p-2 text-gray-500 hover:text-white transition-colors" onClick={(e) => { e.stopPropagation(); setVideoFile(null); }}>
                             Change
                          </button>
                        </div>
                      ) : (
                        <>
                           <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] opacity-5 pointer-events-none"></div>
                           <div className="w-20 h-20 bg-jav-gray rounded-full flex items-center justify-center mb-6 text-gray-500 group-hover:text-jav-red group-hover:scale-110 transition-all duration-300">
                              <Upload size={32} />
                           </div>
                           <p className="font-black text-2xl text-white uppercase tracking-tight">Drop MP4 Here</p>
                           <p className="text-sm text-gray-500 mt-2 max-w-[200px]">or select from device</p>
                        </>
                      )}
                    </div>

                    {/* Subtitle Upload Area */}
                    <div className="flex flex-col gap-6">
                       <div 
                        className={`flex-grow border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all cursor-pointer relative
                          ${subFile 
                             ? 'border-jav-yellow bg-jav-yellow/5' 
                             : 'border-gray-800 hover:border-jav-yellow/50 hover:bg-jav-gray/30'}`}
                        onClick={() => subInputRef.current?.click()}
                      >
                        <input 
                          type="file" 
                          accept=".srt,.vtt,.ass" 
                          className="hidden" 
                          ref={subInputRef} 
                          onChange={handleSubUpload}
                        />
                        {subFile ? (
                          <>
                            <FileType className="w-10 h-10 text-jav-yellow mb-3" />
                            <p className="font-bold text-lg text-white break-all">{subFile.name}</p>
                            <span className="text-xs text-green-500 font-semibold mt-1 flex items-center gap-1">
                               <CheckCircle size={10} /> Subtitle Loaded
                            </span>
                            <button className="mt-2 text-xs text-gray-500 hover:text-white underline" onClick={(e) => { e.stopPropagation(); setSubFile(null); }}>Remove</button>
                          </>
                        ) : (
                          <>
                            <div className="w-12 h-12 bg-jav-gray/50 rounded-lg flex items-center justify-center mb-3 text-gray-500">
                               <FileType size={20} />
                            </div>
                            <div>
                               <p className="font-bold text-white uppercase">Upload Subtitles</p>
                               <p className="text-xs text-gray-500 mt-1">Supports .SRT, .VTT, .ASS</p>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Cloud Import Section */}
                      <div className="bg-jav-gray/10 rounded-2xl p-5 border border-white/5">
                        <p className="text-xs text-gray-400 mb-3 font-bold uppercase tracking-wider flex items-center gap-2">
                           Import Source
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                           <CloudButton provider="google" onClick={() => handleCloudClick('google')} />
                           <CloudButton provider="onedrive" onClick={() => handleCloudClick('onedrive')} />
                           <CloudButton provider="onedrive_biz" onClick={() => handleCloudClick('onedrive_biz')} />
                           <CloudButton provider="s3" onClick={() => handleCloudClick('s3')} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Next Button */}
                  <div className="mt-8 flex justify-end pt-6 border-t border-gray-800">
                    <button 
                      disabled={!videoFile}
                      onClick={() => setStep(AppStep.SETTINGS)}
                      className={`px-10 py-4 rounded-xl font-black text-lg uppercase tracking-widest transition-all transform active:scale-95 flex items-center gap-3
                        ${videoFile 
                          ? 'bg-jav-red text-white shadow-[0_4px_20px_rgba(255,0,0,0.4)] hover:shadow-[0_4px_30px_rgba(255,0,0,0.6)] hover:bg-red-600' 
                          : 'bg-jav-gray text-gray-600 cursor-not-allowed'}`}
                    >
                      Configure Output
                      <Play fill="currentColor" size={16} />
                    </button>
                  </div>
               </div>
            </div>
          </div>
        )}

        {/* STEP 2: SETTINGS */}
        {step === AppStep.SETTINGS && (
          <div className="max-w-4xl mx-auto animate-fade-in">
             <div className="bg-jav-black border border-jav-gray rounded-3xl p-8 shadow-2xl relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-jav-red to-jav-yellow"></div>
                
                <h2 className="text-3xl font-black text-white italic uppercase mb-8 flex items-center gap-3">
                  <Settings className="text-jav-yellow" size={32} /> Configuration
                </h2>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* LEFT COLUMN: Controls */}
                  <div className="space-y-6">
                    {/* FPS Slider */}
                    <div className="bg-jav-dark p-6 rounded-2xl border border-gray-800">
                      <div className="flex justify-between mb-4 items-end">
                        <label className="text-white font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                          <Film size={16} /> Frame Rate
                        </label>
                        <div className="px-3 py-1 bg-jav-yellow text-black font-black text-sm rounded">
                          {fps} FPS
                        </div>
                      </div>
                      <input 
                        type="range" 
                        min="15" 
                        max="60" 
                        step="1"
                        value={fps} 
                        onChange={(e) => setFps(parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-jav-red hover:accent-jav-yellow transition-all"
                      />
                    </div>

                    {/* Subtitle Appearance */}
                    <div className="bg-jav-dark p-6 rounded-2xl border border-gray-800">
                      <h3 className="text-white font-bold uppercase tracking-wider text-sm flex items-center gap-2 mb-6 border-b border-gray-800 pb-2">
                        <Palette size={16} /> Subtitle Style
                      </h3>

                       {/* Preset Styles Selector */}
                       <div className="mb-6">
                          <div className="flex justify-between items-end mb-3">
                             <label className="text-gray-400 text-xs font-bold uppercase flex items-center gap-2">
                               <Wand2 size={12} /> Quick Presets
                             </label>
                             
                             {/* Save Preset UI */}
                             {isSaving ? (
                               <div className="flex items-center gap-2 bg-black/50 p-1 rounded-lg border border-jav-yellow/50 animate-fade-in">
                                 <input 
                                   type="text" 
                                   value={newPresetName}
                                   onChange={(e) => setNewPresetName(e.target.value)}
                                   placeholder="Preset Name"
                                   className="bg-transparent text-white text-xs px-2 py-1 outline-none w-24"
                                   autoFocus
                                   onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
                                 />
                                 <button onClick={handleSavePreset} disabled={!newPresetName.trim()} className="text-green-500 hover:text-green-400 p-1"><CheckCircle size={14} /></button>
                                 <button onClick={() => setIsSaving(false)} className="text-red-500 hover:text-red-400 p-1"><X size={14} /></button>
                               </div>
                             ) : (
                               <button 
                                 onClick={() => setIsSaving(true)} 
                                 className="text-[10px] bg-jav-gray hover:bg-white hover:text-black text-white px-2 py-1 rounded flex items-center gap-1 transition-colors border border-gray-700"
                               >
                                  <Save size={10} /> SAVE CURRENT
                               </button>
                             )}
                          </div>

                          {/* System Presets Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                            {PRESETS.map((preset) => (
                              <button
                                key={preset.name}
                                onClick={() => setSubStyle(preset.style)}
                                className="group relative rounded-lg border border-gray-700 bg-black/40 p-2 hover:border-jav-red transition-all duration-300 active:scale-95"
                              >
                                <div className="w-full h-8 mb-2 rounded flex items-center justify-center text-xs overflow-hidden bg-gray-900/50"
                                    style={{ fontFamily: 'Arial, sans-serif' }}>
                                    <span style={{
                                      color: preset.style.primaryColor,
                                      fontWeight: preset.style.bold ? 'bold' : 'normal',
                                      fontStyle: preset.style.italic ? 'italic' : 'normal',
                                      textShadow: `
                                        -${preset.style.outlineWidth}px -${preset.style.outlineWidth}px 0 ${preset.style.outlineColor},  
                                        ${preset.style.outlineWidth}px -${preset.style.outlineWidth}px 0 ${preset.style.outlineColor},
                                        -${preset.style.outlineWidth}px  ${preset.style.outlineWidth}px 0 ${preset.style.outlineColor},
                                        ${preset.style.outlineWidth}px  ${preset.style.outlineWidth}px 0 ${preset.style.outlineColor}
                                      `
                                    }}>Abc</span>
                                </div>
                                <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wide group-hover:text-white text-center truncate">
                                  {preset.name}
                                </span>
                              </button>
                            ))}
                          </div>

                          {/* Custom Presets Grid */}
                          {customPresets.length > 0 && (
                            <div className="animate-fade-in mt-4 pt-4 border-t border-gray-800">
                               <label className="text-gray-500 text-[10px] font-bold uppercase mb-2 block flex items-center gap-2">
                                  <HardDrive size={10} /> My Saved Styles
                               </label>
                               <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                  {customPresets.map((preset, idx) => (
                                      <button
                                        key={`custom-${idx}`}
                                        onClick={() => setSubStyle(preset.style)}
                                        className="group relative rounded-lg border border-jav-yellow/30 bg-jav-yellow/5 p-2 hover:border-jav-yellow hover:bg-jav-yellow/10 transition-all duration-300 w-full active:scale-95"
                                      >
                                        <div className="w-full h-8 mb-2 rounded flex items-center justify-center text-xs overflow-hidden bg-black/50"
                                            style={{ fontFamily: 'Arial, sans-serif' }}>
                                            <span style={{
                                              color: preset.style.primaryColor,
                                              fontWeight: preset.style.bold ? 'bold' : 'normal',
                                              fontStyle: preset.style.italic ? 'italic' : 'normal',
                                              textShadow: `
                                                -${preset.style.outlineWidth}px -${preset.style.outlineWidth}px 0 ${preset.style.outlineColor},  
                                                ${preset.style.outlineWidth}px -${preset.style.outlineWidth}px 0 ${preset.style.outlineColor},
                                                -${preset.style.outlineWidth}px  ${preset.style.outlineWidth}px 0 ${preset.style.outlineColor},
                                                ${preset.style.outlineWidth}px  ${preset.style.outlineWidth}px 0 ${preset.style.outlineColor}
                                              `
                                            }}>Abc</span>
                                        </div>
                                        <span className="block text-[10px] text-jav-yellow font-bold uppercase tracking-wide group-hover:text-white text-center truncate pr-4">
                                          {preset.name}
                                        </span>
                                        <div 
                                          onClick={(e) => handleDeletePreset(idx, e)}
                                          className="absolute top-1 right-1 p-1 text-red-900/50 hover:text-red-500 cursor-pointer opacity-0 group-hover:opacity-100 transition-all z-10"
                                          title="Delete Preset"
                                        >
                                          <Trash2 size={12} />
                                        </div>
                                      </button>
                                  ))}
                               </div>
                            </div>
                          )}
                       </div>
                      
                      <div className="space-y-6 pt-2 border-t border-gray-800/50">
                         {/* Size & Position */}
                         <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-gray-400 text-xs font-bold uppercase mb-2 block">Size</label>
                              <input 
                                type="range" min="12" max="72" value={subStyle.fontSize}
                                onChange={(e) => setSubStyle({...subStyle, fontSize: parseInt(e.target.value)})}
                                className="w-full h-1.5 bg-gray-800 rounded appearance-none cursor-pointer accent-white"
                              />
                              <div className="text-right text-[10px] text-gray-500 mt-1">{subStyle.fontSize}px</div>
                            </div>
                            <div>
                              <label className="text-gray-400 text-xs font-bold uppercase mb-2 block">Margin V</label>
                              <input 
                                type="range" min="0" max="200" value={subStyle.marginV}
                                onChange={(e) => setSubStyle({...subStyle, marginV: parseInt(e.target.value)})}
                                className="w-full h-1.5 bg-gray-800 rounded appearance-none cursor-pointer accent-white"
                              />
                              <div className="text-right text-[10px] text-gray-500 mt-1">{subStyle.marginV}px</div>
                            </div>
                         </div>

                         {/* Colors */}
                         <div className="grid grid-cols-2 gap-4">
                           <div>
                              <label className="text-gray-400 text-xs font-bold uppercase mb-2 block">Text Color</label>
                              <div className="flex items-center gap-2">
                                <input 
                                  type="color" 
                                  value={subStyle.primaryColor}
                                  onChange={(e) => setSubStyle({...subStyle, primaryColor: e.target.value})}
                                  className="w-8 h-8 rounded cursor-pointer bg-transparent border-none"
                                />
                                <span className="text-xs font-mono text-gray-400">{subStyle.primaryColor}</span>
                              </div>
                           </div>
                           <div>
                              <label className="text-gray-400 text-xs font-bold uppercase mb-2 block">Outline</label>
                              <div className="flex items-center gap-2">
                                <input 
                                  type="color" 
                                  value={subStyle.outlineColor}
                                  onChange={(e) => setSubStyle({...subStyle, outlineColor: e.target.value})}
                                  className="w-8 h-8 rounded cursor-pointer bg-transparent border-none"
                                />
                                <span className="text-xs font-mono text-gray-400">{subStyle.outlineColor}</span>
                              </div>
                           </div>
                         </div>

                         {/* Outline Width & Toggles */}
                         <div>
                            <label className="text-gray-400 text-xs font-bold uppercase mb-2 block flex justify-between">
                              Outline Width <span>{subStyle.outlineWidth}px</span>
                            </label>
                            <input 
                              type="range" min="0" max="8" step="0.5" value={subStyle.outlineWidth}
                              onChange={(e) => setSubStyle({...subStyle, outlineWidth: parseFloat(e.target.value)})}
                              className="w-full h-1.5 bg-gray-800 rounded appearance-none cursor-pointer accent-white mb-4"
                            />

                            <div className="flex gap-2">
                              <button 
                                onClick={() => setSubStyle({...subStyle, bold: !subStyle.bold})}
                                className={`flex-1 py-2 rounded text-xs font-bold uppercase border transition-colors ${subStyle.bold ? 'bg-white text-black border-white' : 'bg-transparent text-gray-500 border-gray-700'}`}
                              >
                                BOLD
                              </button>
                              <button 
                                onClick={() => setSubStyle({...subStyle, italic: !subStyle.italic})}
                                className={`flex-1 py-2 rounded text-xs font-bold uppercase border transition-colors ${subStyle.italic ? 'bg-white text-black border-white' : 'bg-transparent text-gray-500 border-gray-700'}`}
                              >
                                ITALIC
                              </button>
                            </div>
                         </div>
                         
                         {/* Alignment */}
                         <div>
                            <label className="text-gray-400 text-xs font-bold uppercase mb-2 block">Position</label>
                            <div className="flex gap-2 bg-black/50 p-1 rounded-lg">
                               <button 
                                  onClick={() => setSubStyle({...subStyle, alignment: 8})}
                                  className={`flex-1 py-1.5 rounded text-[10px] font-bold uppercase transition-colors ${subStyle.alignment === 8 ? 'bg-jav-red text-white' : 'text-gray-500 hover:text-white'}`}
                               >
                                 TOP
                               </button>
                               <button 
                                  onClick={() => setSubStyle({...subStyle, alignment: 5})}
                                  className={`flex-1 py-1.5 rounded text-[10px] font-bold uppercase transition-colors ${subStyle.alignment === 5 ? 'bg-jav-red text-white' : 'text-gray-500 hover:text-white'}`}
                               >
                                 MIDDLE
                               </button>
                               <button 
                                  onClick={() => setSubStyle({...subStyle, alignment: 2})}
                                  className={`flex-1 py-1.5 rounded text-[10px] font-bold uppercase transition-colors ${subStyle.alignment === 2 ? 'bg-jav-red text-white' : 'text-gray-500 hover:text-white'}`}
                               >
                                 BOTTOM
                               </button>
                            </div>
                         </div>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT COLUMN: Preview & Actions */}
                  <div className="flex flex-col gap-6">
                    {/* PREVIEW SECTION */}
                    <div className="bg-black p-1 rounded-2xl border border-gray-800 shadow-inner flex-grow flex flex-col">
                       <div className="bg-jav-dark/50 rounded-xl overflow-hidden p-4 flex-grow flex flex-col">
                          <div className="flex items-center justify-between mb-4">
                             <div className="flex items-center gap-2">
                               <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                               <h3 className="text-white font-bold text-sm uppercase">Preview Window</h3>
                             </div>
                             <button 
                               onClick={generatePreview}
                               disabled={isPreviewGenerating}
                               className="text-[10px] font-bold bg-jav-gray hover:bg-white hover:text-black text-white px-3 py-1.5 rounded transition-all flex items-center gap-2 border border-gray-700"
                             >
                               {isPreviewGenerating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCcw size={12} />}
                               {previewUrl ? 'REFRESH' : 'GENERATE'}
                             </button>
                          </div>

                          <div className="relative flex-grow min-h-[250px] bg-black/80 rounded-lg flex items-center justify-center border border-white/5 overflow-hidden">
                             {isPreviewGenerating ? (
                               <div className="flex flex-col items-center gap-3">
                                 <Loader2 className="w-8 h-8 text-jav-yellow animate-spin" />
                                 <span className="text-xs text-jav-yellow font-mono">RENDERING 5S CLIP...</span>
                               </div>
                             ) : previewUrl ? (
                               <video 
                                 controls 
                                 autoPlay 
                                 loop 
                                 src={previewUrl} 
                                 className="w-full h-full object-contain max-h-[400px]" 
                               />
                             ) : (
                               <div className="text-center p-8 opacity-50">
                                 <Play className="w-12 h-12 text-white mx-auto mb-3" />
                                 <p className="text-xs text-gray-400 max-w-[200px] mx-auto">
                                   Click GENERATE to check subtitle sync and styling.
                                 </p>
                                 {/* Live Text Preview (Static CSS Approximation) */}
                                 <div className="mt-8 pointer-events-none select-none">
                                    <span style={{
                                       color: subStyle.primaryColor,
                                       fontSize: `${subStyle.fontSize}px`,
                                       fontWeight: subStyle.bold ? 'bold' : 'normal',
                                       fontStyle: subStyle.italic ? 'italic' : 'normal',
                                       textShadow: `
                                         -${subStyle.outlineWidth}px -${subStyle.outlineWidth}px 0 ${subStyle.outlineColor},  
                                          ${subStyle.outlineWidth}px -${subStyle.outlineWidth}px 0 ${subStyle.outlineColor},
                                         -${subStyle.outlineWidth}px  ${subStyle.outlineWidth}px 0 ${subStyle.outlineColor},
                                          ${subStyle.outlineWidth}px  ${subStyle.outlineWidth}px 0 ${subStyle.outlineColor}
                                       `,
                                       fontFamily: 'Arial, sans-serif'
                                    }}>
                                      Preview Text Style
                                    </span>
                                 </div>
                               </div>
                             )}
                          </div>
                       </div>
                    </div>

                     {/* Error Display */}
                     {error && (
                      <div className="bg-red-950/30 border border-red-500/50 p-4 rounded-xl flex items-start gap-3 animate-pulse">
                        <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
                        <p className="text-red-200 text-sm font-medium">{error}</p>
                      </div>
                    )}

                    <div className="flex gap-4">
                      <button 
                        onClick={() => setStep(AppStep.UPLOAD)}
                        className="px-6 py-4 rounded-xl font-bold text-gray-400 hover:text-white hover:bg-jav-gray transition-colors"
                      >
                        BACK
                      </button>
                      <button 
                        onClick={startProcessing}
                        className="flex-1 px-6 py-4 rounded-xl font-black text-white bg-jav-red hover:bg-red-600 shadow-lg shadow-red-900/30 transition-all flex items-center justify-center gap-2 uppercase tracking-wide"
                      >
                         START RENDERING <Play fill="currentColor" size={16} />
                      </button>
                    </div>
                  </div>
                </div>
             </div>
          </div>
        )}

        {/* STEP 3: PROCESSING */}
        {step === AppStep.PROCESSING && (
           <div className="max-w-3xl mx-auto animate-fade-in">
             <div className="bg-jav-black border border-jav-gray rounded-3xl p-10 shadow-2xl text-center relative overflow-hidden">
               {/* Background animation */}
               <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-900/10 via-transparent to-transparent animate-pulse"></div>
               
               <div className="relative w-56 h-56 mx-auto mb-10 flex items-center justify-center">
                 {/* Tech Spinner Rings */}
                 <div className="absolute inset-0 border-[6px] border-jav-gray/30 rounded-full"></div>
                 <div className="absolute inset-0 border-[6px] border-jav-red rounded-full border-t-transparent animate-spin" style={{ animationDuration: '1s' }}></div>
                 <div className="absolute inset-4 border-[2px] border-jav-yellow rounded-full border-b-transparent animate-spin-reverse opacity-50" style={{ animationDuration: '2s' }}></div>
                 
                 <div className="flex flex-col items-center z-10">
                   <span className="text-6xl font-black text-white tracking-tighter">{progress}%</span>
                   <span className="text-xs text-jav-yellow font-bold uppercase tracking-[0.2em] mt-2 animate-pulse">Encoding</span>
                 </div>
               </div>

               <h2 className="text-2xl font-bold text-white mb-3 uppercase">Processing Video</h2>
               <p className="text-gray-500 mb-8 max-w-md mx-auto text-sm">
                 Please wait while we burn subtitles and resample frames. Large files (10GB+) may take significant time. <br/>
                 <span className="text-jav-red font-bold">DO NOT CLOSE THIS TAB.</span>
               </p>

               {/* Terminal Output */}
               <div className="bg-black rounded-lg border border-gray-800 p-4 font-mono text-[10px] text-left h-32 overflow-y-auto custom-scrollbar opacity-80" ref={terminalRef}>
                 <div className="text-green-500 mb-1">$ initializing_wasm_worker --threads=auto</div>
                 <div className="text-gray-500 mb-1">$ mount_filesystem --type=WORKERFS</div>
                 {logMessage && <div className="text-jav-yellow typing-effect">{`> ${logMessage}`}</div>}
               </div>
             </div>
           </div>
        )}

        {/* STEP 4: COMPLETED */}
        {step === AppStep.COMPLETED && outputUrl && (
          <div className="max-w-3xl mx-auto animate-fade-in">
            <div className="bg-jav-black border-2 border-jav-yellow rounded-3xl p-1 shadow-[0_0_100px_rgba(255,215,0,0.15)] text-center relative overflow-hidden">
               <div className="bg-jav-dark rounded-[20px] p-10 relative z-10">
                 <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 text-black border-4 border-black shadow-[0_0_20px_rgba(34,197,94,0.6)]">
                   <CheckCircle size={48} strokeWidth={3} />
                 </div>

                 <h2 className="text-4xl font-black text-white mb-2 italic uppercase">Mission Complete</h2>
                 <p className="text-gray-400 mb-8">Your video is ready for download.</p>

                 {/* Preview Video */}
                 <div className="mb-8 rounded-xl overflow-hidden border-2 border-gray-800 bg-black aspect-video shadow-2xl">
                   <video controls src={outputUrl} className="w-full h-full object-contain" />
                 </div>

                 <div className="flex flex-col sm:flex-row gap-4 justify-center">
                   <a 
                     href={outputUrl} 
                     download={`JAV_TH_${Date.now()}.mp4`}
                     className="px-8 py-4 rounded-xl font-black text-black bg-jav-yellow hover:bg-yellow-400 transition-colors flex items-center justify-center gap-3 shadow-[0_5px_0_rgb(180,150,0)] active:shadow-none active:translate-y-[5px]"
                   >
                     <Download size={24} /> DOWNLOAD VIDEO
                   </a>
                   <button 
                     onClick={resetApp}
                     className="px-8 py-4 rounded-xl font-bold text-white bg-gray-800 hover:bg-gray-700 transition-colors"
                   >
                     PROCESS ANOTHER
                   </button>
                 </div>
               </div>
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-gray-900 mt-auto bg-black">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-600 text-xs font-mono">
             JAV TH TOOLS © {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
