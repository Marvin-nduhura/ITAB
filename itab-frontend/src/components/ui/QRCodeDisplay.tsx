import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Download } from 'lucide-react';
import { Button } from './Button';

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  label?: string;
  downloadFileName?: string;
}

export function QRCodeDisplay({ value, size = 200, label, downloadFileName }: QRCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    if (!value) return;
    QRCode.toCanvas(canvasRef.current!, value, {
      width: size,
      margin: 2,
      color: { dark: '#1e293b', light: '#ffffff' },
    }, (err) => {
      if (err) console.error('QR generation error:', err);
    });

    QRCode.toDataURL(value, {
      width: size,
      margin: 2,
      color: { dark: '#1e293b', light: '#ffffff' },
    }).then(url => setDataUrl(url)).catch(console.error);
  }, [value, size]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${downloadFileName || 'qrcode'}.png`;
    a.click();
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-200 dark:border-slate-600">
        <canvas ref={canvasRef} className="rounded-xl" />
      </div>
      {label && (
        <p className="text-xs text-slate-500 dark:text-slate-400 text-center max-w-[200px]">{label}</p>
      )}
      {downloadFileName && (
        <Button size="sm" variant="secondary" icon={<Download size={13} />} onClick={handleDownload}>
          Download QR
        </Button>
      )}
    </div>
  );
}
