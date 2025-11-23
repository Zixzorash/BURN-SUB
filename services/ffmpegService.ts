
import { SubtitleStyle } from '../types';

export class FFmpegService {
  private ffmpeg: any = null;
  private loaded: boolean = false;
  private logCallback: ((msg: string) => void) | null = null;
  private progressCallback: ((p: number) => void) | null = null;

  constructor() {
    // Constructor remains empty to prevent errors during module evaluation.
  }

  private get globalFFmpeg() {
    return (window as any).FFmpeg;
  }

  private get globalUtil() {
    return (window as any).FFmpegUtil;
  }

  /**
   * Polls for the global FFmpeg object to be available.
   * This handles cases where the script takes a few seconds to load from CDN.
   */
  private async waitForGlobals(): Promise<void> {
    if (this.globalFFmpeg && this.globalFFmpeg.FFmpeg) return;

    let retries = 0;
    while (retries < 50) { // Wait up to 5 seconds
      await new Promise(r => setTimeout(r, 100));
      if (this.globalFFmpeg && this.globalFFmpeg.FFmpeg) return;
      retries++;
    }
    throw new Error("FFmpeg library failed to load. Please check your internet connection, ad blockers, or refresh the page.");
  }

  /**
   * Initializes the FFmpeg instance if not already done.
   */
  async load() {
    if (this.loaded && this.ffmpeg) return;

    await this.waitForGlobals();

    if (!this.ffmpeg) {
        const FFmpegClass = this.globalFFmpeg.FFmpeg;
        this.ffmpeg = new FFmpegClass();

        // Attach persistent listeners that delegate to the current callback function
        this.ffmpeg.on('log', ({ message }: { message: string }) => {
            if (this.logCallback) this.logCallback(message);
        });

        this.ffmpeg.on('progress', ({ progress }: { progress: number }) => {
            if (this.progressCallback) this.progressCallback(Math.round(progress * 100));
        });
    }

    // Use the Single Threaded version of the core to ensure compatibility
    // This avoids SharedArrayBuffer requirements which often fail without specific server headers
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    const { toBlobURL } = this.globalUtil;
    
    try {
        // Fetch scripts and create local Blob URLs to bypass CORS worker restrictions
        const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
        const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm');

        await this.ffmpeg.load({
            coreURL: coreURL,
            wasmURL: wasmURL,
        });
        this.loaded = true;
    } catch (e) {
        console.error("Failed to load FFmpeg core:", e);
        throw new Error("Failed to initialize video engine. Network or CORS error.");
    }
  }

  setLogger(callback: (message: string) => void) {
    this.logCallback = callback;
    // We do not force initialization here to avoid premature errors. 
    // The callback will be used once load() is called by the main process.
  }

  setProgress(callback: (progress: number) => void) {
    this.progressCallback = callback;
  }

  /**
   * Helper to convert Hex color to ASS format (&H00BBGGRR)
   */
  private toAssColor(hex: string): string {
    // Remove # if present
    const cleanHex = hex.replace('#', '');
    if (cleanHex.length !== 6) return '&H00FFFFFF';
    
    const r = cleanHex.substring(0, 2);
    const g = cleanHex.substring(2, 4);
    const b = cleanHex.substring(4, 6);
    
    // ASS is BGR
    return `&H00${b}${g}${r}`;
  }

  private generateStyleString(style: SubtitleStyle): string {
    const primary = this.toAssColor(style.primaryColor);
    const outline = this.toAssColor(style.outlineColor);
    const bold = style.bold ? '1' : '0';
    const italic = style.italic ? '1' : '0';
    
    // BorderStyle=1 is Outline (standard), 3 is Box
    return `FontName=Arial,FontSize=${style.fontSize},PrimaryColour=${primary},OutlineColour=${outline},BackColour=&H80000000,BorderStyle=1,Outline=${style.outlineWidth},Shadow=0,MarginV=${style.marginV},Alignment=${style.alignment},Bold=${bold},Italic=${italic}`;
  }

  async createPreview(
    videoFile: File,
    subFile: File | null,
    fps: number,
    style: SubtitleStyle
  ): Promise<string> {
    await this.load();
    const { fetchFile } = this.globalUtil;

    const inputName = 'preview_input.mp4';
    let subName = 'preview_sub.srt'; // Default, will be updated if file exists
    const outputName = 'preview_output.mp4';

    // Optimization: Slice the video file.
    // We take the first 50MB. This creates a valid partial file for most MP4 containers (MOOV at start).
    const CHUNK_SIZE = 50 * 1024 * 1024; // 50MB
    const videoSlice = videoFile.slice(0, Math.min(videoFile.size, CHUNK_SIZE));

    try {
      // Write files to memory (MEMFS) for preview as it's small
      await this.ffmpeg.writeFile(inputName, await fetchFile(videoSlice));
      
      if (subFile) {
        // Detect extension to support .ass, .vtt, .srt
        const ext = subFile.name.split('.').pop()?.toLowerCase() || 'srt';
        subName = `preview_sub.${ext}`;
        await this.ffmpeg.writeFile(subName, await fetchFile(subFile));
      }

      const args = [
        '-i', inputName,
        '-t', '5', // Limit duration to 5 seconds
      ];

      // Video Filter Chain
      const filters: string[] = [];
      
      if (subFile) {
        const styleStr = this.generateStyleString(style);
        filters.push(`subtitles=${subName}:force_style='${styleStr}'`);
      }

      if (filters.length > 0) {
        args.push('-vf', filters.join(','));
      }

      // Set Frame Rate
      args.push('-r', fps.toString());

      // Output settings
      args.push('-c:a', 'copy');
      args.push('-preset', 'ultrafast'); 
      args.push(outputName);

      await this.ffmpeg.exec(args);
      const data = await this.ffmpeg.readFile(outputName);
      const blob = new Blob([data], { type: 'video/mp4' });
      
      // Cleanup
      await this.ffmpeg.deleteFile(inputName);
      if (subFile) await this.ffmpeg.deleteFile(subName);
      await this.ffmpeg.deleteFile(outputName);

      return URL.createObjectURL(blob);
    } catch (error) {
      console.error('Preview generation error:', error);
      // Attempt cleanup
      try { await this.ffmpeg.deleteFile(inputName); } catch(e) {}
      try { if(subFile) await this.ffmpeg.deleteFile(subName); } catch(e) {}
      throw new Error("Failed to generate preview. The file format might not support partial reading.");
    }
  }

  async processVideo(
    videoFile: File,
    subFile: File | null,
    fps: number,
    outputName: string,
    style: SubtitleStyle
  ): Promise<string> {
    await this.load();
    const { fetchFile } = this.globalUtil;

    const mountDir = '/mnt_input';
    let subName = 'subtitles.srt'; // Default
    
    // SAFE FILENAME STRATEGY
    // We create a standardized filename to avoid FFmpeg command line errors with spaces/emojis.
    // This creates a new File reference pointing to the same data (zero-copy).
    const safeInputName = 'source_video.mp4';
    const safeVideoFile = new File([videoFile], safeInputName, { type: videoFile.type });
    const inputPath = `${mountDir}/${safeInputName}`;
    
    // Large File Optimization Thresholds
    const isLargeFile = videoFile.size > 2 * 1024 * 1024 * 1024; // > 2GB
    const isMassiveFile = videoFile.size > 10 * 1024 * 1024 * 1024; // > 10GB
    
    let usedMount = false;

    // CRITICAL CLEANUP: Ensure previous session mounts are gone
    try {
        await this.ffmpeg.unmount(mountDir);
        await this.ffmpeg.deleteDir(mountDir);
    } catch (e) {
        // Directory usually doesn't exist, ignore error
    }

    try {
        // Attempt to mount the file system
        // WORKERFS allows reading directly from the File object without loading it into RAM.
        await this.ffmpeg.createDir(mountDir);
        await this.ffmpeg.mount('WORKERFS', { files: [safeVideoFile] }, mountDir);
        usedMount = true;
    } catch (e) {
        console.warn("WORKERFS mount failed:", e);
        // SAFETY CHECK: If file is > 2GB, do not attempt to write to memory.
        if (isLargeFile) {
             throw new Error("Processing failed. System could not mount large file. Please use a browser that supports WORKERFS (Chrome/Edge/Firefox).");
        }
        
        // Fallback for smaller files only
        const simpleName = 'input.mp4';
        await this.ffmpeg.writeFile(simpleName, await fetchFile(videoFile));
        throw new Error("System Error: Could not mount file system. Please refresh and try again.");
    }

    if (subFile) {
      // Detect extension to support .ass, .vtt, .srt
      const ext = subFile.name.split('.').pop()?.toLowerCase() || 'srt';
      subName = `subtitles.${ext}`;
      await this.ffmpeg.writeFile(subName, await fetchFile(subFile));
    }

    const args = ['-i', inputPath];

    // Filter Construction
    const filters: string[] = [];
    
    // Optimization: Downscale large files to ensure output fits in browser memory (MEMFS limit)
    if (isLargeFile) {
        if (this.logCallback) this.logCallback("Large file detected: Activating 720p downscaling to prevent memory crash...");
        // Scale to 720p height, keep aspect ratio (-2)
        // NOTE: Scaling must happen BEFORE burning subtitles for better performance, 
        filters.push('scale=-2:720');
    }

    if (subFile) {
      const styleStr = this.generateStyleString(style);
      filters.push(`subtitles=${subName}:force_style='${styleStr}'`);
    }

    if (filters.length > 0) {
      args.push('-vf', filters.join(','));
    }

    args.push('-r', fps.toString());
    
    // Codec & Performance Settings
    args.push('-c:v', 'libx264');
    
    if (isLargeFile) {
        // Aggressive optimization for large files
        args.push('-preset', 'ultrafast'); // Max encoding speed
        args.push('-crf', '28'); // Higher CRF = lower bitrate = smaller output file (saves RAM)
        args.push('-tune', 'fastdecode');
        
        if (isMassiveFile) {
            // Limit threads to reduce WASM stack memory usage per thread
            args.push('-threads', '2');
        }
    } else {
        args.push('-preset', 'veryfast');
        args.push('-crf', '23'); // Standard quality
    }

    // Safety flags
    args.push('-max_muxing_queue_size', '9999'); 
    args.push('-c:a', 'copy'); // Copy audio to save CPU/RAM
    args.push(outputName);

    try {
        const result = await this.ffmpeg.exec(args);
        if (result !== 0) {
            throw new Error(`FFmpeg exited with code ${result}. Check logs.`);
        }
    } catch (e) {
        console.error("FFmpeg Execution Error:", e);
        // Force cleanup if execution fails
        if (usedMount) {
            try {
                await this.ffmpeg.unmount(mountDir);
                await this.ffmpeg.deleteDir(mountDir);
            } catch(cleanErr) {}
        }
        throw e;
    }

    // Read output
    let data;
    try {
        data = await this.ffmpeg.readFile(outputName);
    } catch (e) {
        throw new Error("Output generation failed. The result file size exceeded browser memory limits (approx 2GB). Try reducing duration or using a computer with more RAM.");
    }
    
    const blob = new Blob([data], { type: 'video/mp4' });

    // Final Cleanup
    if (usedMount) {
        try {
            await this.ffmpeg.unmount(mountDir);
            await this.ffmpeg.deleteDir(mountDir);
        } catch(e) {}
    }
    
    if (subFile) await this.ffmpeg.deleteFile(subName);
    await this.ffmpeg.deleteFile(outputName);

    return URL.createObjectURL(blob);
  }
}

export const ffmpegService = new FFmpegService();
