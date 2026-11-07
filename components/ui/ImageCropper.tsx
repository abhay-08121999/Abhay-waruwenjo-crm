import React, { useState, useCallback } from 'react';
import Cropper, { Point, Area } from 'react-easy-crop';
import { Button } from './button';
import { Slider } from './slider';
import { X, ZoomIn, ZoomOut, Check } from 'lucide-react';

interface ImageCropperProps {
  image: string;
  onCropComplete: (croppedImage: Blob) => void;
  onCancel: () => void;
  aspectRatio?: number;
}

const ImageCropper: React.FC<ImageCropperProps> = ({ 
  image, 
  onCropComplete, 
  onCancel, 
  aspectRatio = 1 
}) => {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropChange = (crop: Point) => {
    setCrop(crop);
  };

  const onZoomChange = (zoom: number) => {
    setZoom(zoom);
  };

  const onCropAreaComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });

  const getCroppedImg = async (
    imageSrc: string,
    pixelCrop: Area
  ): Promise<Blob | null> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) return null;

    // Standard Size Limit implementation (Max 1200px)
    const MAX_SIZE = 1200;
    let targetWidth = pixelCrop.width;
    let targetHeight = pixelCrop.height;

    if (targetWidth > MAX_SIZE || targetHeight > MAX_SIZE) {
      if (targetWidth > targetHeight) {
        targetHeight = (MAX_SIZE / targetWidth) * targetHeight;
        targetWidth = MAX_SIZE;
      } else {
        targetWidth = (MAX_SIZE / targetHeight) * targetWidth;
        targetHeight = MAX_SIZE;
      }
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      targetWidth,
      targetHeight
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/jpeg', 0.85); // 0.85 quality for good balance
    });
  };

  const handleSave = async () => {
    if (croppedAreaPixels) {
      try {
        const croppedImage = await getCroppedImg(image, croppedAreaPixels);
        if (croppedImage) {
          onCropComplete(croppedImage);
        }
      } catch (e) {
        console.error("Error cropping image:", e);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight">Adjust Image</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Scale and position your photo</p>
          </div>
          <button onClick={onCancel} className="p-2 hover:bg-slate-50 text-slate-400 rounded-xl transition-all">
            <X size={24} />
          </button>
        </div>

        <div className="relative h-[400px] bg-slate-100">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            aspect={aspectRatio}
            onCropChange={onCropChange}
            onCropComplete={onCropAreaComplete}
            onZoomChange={onZoomChange}
            classes={{
              containerClassName: "rounded-b-none",
            }}
          />
        </div>

        <div className="p-8 space-y-8 bg-white">
          <div className="space-y-4">
            <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest text-slate-500">
              <span className="flex items-center gap-2"><ZoomOut size={14} /> Zoom Level</span>
              <span className="text-teal-600 bg-teal-50 px-2.5 py-1 rounded-lg">{Math.round(zoom * 100)}%</span>
            </div>
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.01}
              onValueChange={(value) => setZoom(value[0])}
            />
          </div>

          <div className="flex gap-4 justify-end">
            <Button variant="outline" onClick={onCancel} className="rounded-2xl px-8 h-12">
              Cancel
            </Button>
            <Button onClick={handleSave} className="rounded-2xl px-8 h-12 flex items-center gap-2">
              <Check size={18} /> Apply Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCropper;
