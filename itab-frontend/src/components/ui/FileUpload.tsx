import { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Camera, Image, X, File, FileText, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl: string;       // base64 data URL for preview / local use
  file: File;
}

interface FileUploadProps {
  accept?: string;                    // e.g. "image/*" or ".pdf,.doc"
  multiple?: boolean;
  maxSizeMB?: number;
  maxFiles?: number;
  value?: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  onRemove?: (id: string) => void;
  label?: string;
  hint?: string;
  showCamera?: boolean;               // show "Take Photo" button (mobile)
  showPreview?: boolean;              // show image thumbnails
  compact?: boolean;
  className?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function FileUpload({
  accept = 'image/*',
  multiple = true,
  maxSizeMB = 10,
  maxFiles = 10,
  value = [],
  onChange,
  onRemove,
  label,
  hint,
  showCamera = true,
  showPreview = true,
  compact = false,
  className,
}: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const processFiles = useCallback(async (rawFiles: FileList | File[]) => {
    const files = Array.from(rawFiles);
    const newErrors: string[] = [];
    const processed: UploadedFile[] = [];

    for (const file of files) {
      if (file.size > maxSizeMB * 1024 * 1024) {
        newErrors.push(`"${file.name}" is too large (max ${maxSizeMB}MB)`);
        continue;
      }
      if (value.length + processed.length >= maxFiles) {
        newErrors.push(`Maximum ${maxFiles} files allowed`);
        break;
      }
      try {
        const dataUrl = await fileToDataUrl(file);
        processed.push({
          id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
          name: file.name,
          size: file.size,
          type: file.type,
          dataUrl,
          file,
        });
      } catch {
        newErrors.push(`Failed to read "${file.name}"`);
      }
    }

    setErrors(newErrors);
    if (processed.length > 0) {
      onChange(multiple ? [...value, ...processed] : processed);
    }
  }, [value, onChange, maxSizeMB, maxFiles, multiple]);

  // Drag handlers
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files);
  };

  const isImage = accept.includes('image');

  // Open camera directly — uses capture attribute so the device camera launches immediately
  const openCamera = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Reset the input so the same file can be re-selected
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
      cameraInputRef.current.click();
    }
  };

  const openFileBrowser = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  return (
    <div className={cn('w-full space-y-3', className)}>
      {label && <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>}

      {/* Hidden file inputs — kept outside the drop zone so clicks don't bubble */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={e => { if (e.target.files) processFiles(e.target.files); }}
      />
      {/*
        Camera input:
        - accept="image/*" restricts to images
        - capture="environment" opens the rear camera directly on mobile
        - On desktop browsers this falls back to the normal file picker
      */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => { if (e.target.files) processFiles(e.target.files); }}
      />

      {/* Drop zone — clicking opens file browser, NOT camera */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={openFileBrowser}
        className={cn(
          'relative border-2 border-dashed rounded-2xl transition-all duration-200 cursor-pointer',
          isDragging
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 scale-[1.01]'
            : 'border-slate-300 dark:border-slate-600 hover:border-primary-400 hover:bg-slate-50 dark:hover:bg-slate-800/50',
          compact ? 'p-4' : 'p-8'
        )}
      >
        <div className="flex flex-col items-center gap-3 text-center pointer-events-none">
          <div className={cn(
            'rounded-2xl flex items-center justify-center transition-colors',
            compact ? 'w-10 h-10' : 'w-14 h-14',
            isDragging ? 'bg-primary-100 dark:bg-primary-900/40' : 'bg-slate-100 dark:bg-slate-700'
          )}>
            <Upload size={compact ? 18 : 24} className={isDragging ? 'text-primary-600' : 'text-slate-400'} />
          </div>
          {!compact && (
            <>
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {isDragging ? 'Drop files here' : 'Drag & drop files here'}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">or click to browse your device</p>
              </div>
              <p className="text-xs text-slate-400">
                {accept === 'image/*' ? 'JPG, PNG, WEBP, GIF' : accept.toUpperCase().replace(/\./g, '').replace(/,/g, ', ')}
                {' · '}Max {maxSizeMB}MB{multiple ? ` · Up to ${maxFiles} files` : ''}
              </p>
            </>
          )}
          {compact && (
            <p className="text-xs text-slate-500 dark:text-slate-400">Click or drag to upload</p>
          )}
        </div>
      </div>

      {/* Action buttons — each has its own explicit handler, no event bubbling to drop zone */}
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={openFileBrowser}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          {isImage ? <Image size={15} className="text-primary-600" /> : <File size={15} className="text-primary-600" />}
          Browse {isImage ? 'Photos' : 'Files'}
        </button>

        {showCamera && isImage && (
          <button
            type="button"
            onClick={openCamera}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 text-sm font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
          >
            <Camera size={15} className="text-emerald-600" />
            Take Photo
          </button>
        )}

        {!isImage && (
          <button
            type="button"
            onClick={openFileBrowser}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <FileText size={15} className="text-blue-600" />
            Browse Documents
          </button>
        )}
      </div>

      {/* Error messages */}
      <AnimatePresence>
        {errors.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="space-y-1">
            {errors.map((err, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                <AlertCircle size={12} className="flex-shrink-0" />
                {err}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview grid */}
      {showPreview && value.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {value.length} file{value.length !== 1 ? 's' : ''} selected
          </p>
          <div className={cn(
            'grid gap-2',
            isImage ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5' : 'grid-cols-1'
          )}>
            {value.map((f, i) => (
              <motion.div key={f.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }}
                className={cn(
                  'relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-600',
                  isImage ? 'aspect-square' : 'flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50'
                )}>
                {isImage ? (
                  <>
                    <img src={f.dataUrl} alt={f.name} className="w-full h-full object-cover" />
                    {i === 0 && (
                      <div className="absolute top-1 left-1 bg-primary-600 text-white text-xs px-1.5 py-0.5 rounded-md font-medium">
                        Cover
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText size={16} className="text-primary-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">{f.name}</p>
                      <p className="text-xs text-slate-400">{formatBytes(f.size)}</p>
                    </div>
                  </>
                )}
                {/* Remove button */}
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    onRemove ? onRemove(f.id) : onChange(value.filter(x => x.id !== f.id));
                  }}
                  className={cn(
                    'absolute bg-red-500 text-white rounded-full flex items-center justify-center transition-opacity hover:bg-red-600',
                    isImage
                      ? 'top-1 right-1 w-6 h-6 opacity-0 group-hover:opacity-100'
                      : 'right-2 top-1/2 -translate-y-1/2 w-6 h-6'
                  )}
                >
                  <X size={12} />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
