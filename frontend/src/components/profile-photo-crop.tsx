"use client";

import { useState, useCallback } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { RotateCw, FlipHorizontal, FlipVertical, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Modal, Button } from "@/components/ui";

// ──────────────────────────────────────────────
//  Profile Photo Crop Modal
//  Uses react-easy-crop with circular crop area
// ──────────────────────────────────────────────

interface ProfilePhotoCropProps {
  open: boolean;
  onClose: () => void;
  /** Data URL from file input or existing image URL */
  imageUrl: string;
  /** Called with the cropped image as a Blob */
  onCropComplete: (croppedBlob: Blob) => void;
  /** Called when user wants to select a different image */
  onChangeImage?: () => void;
}

export function ProfilePhotoCrop({
  open,
  onClose,
  imageUrl,
  onCropComplete,
  onChangeImage,
}: ProfilePhotoCropProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    setIsSaving(true);
    try {
      const blob = await getCroppedImg(imageUrl, croppedAreaPixels, rotation, flipH, flipV);
      onCropComplete(blob);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? `Crop failed: ${err.message}` : "Crop failed");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Crop Profile Photo"
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} className="whitespace-nowrap">
            Cancel
          </Button>
          {onChangeImage && (
            <Button variant="ghost" onClick={onChangeImage} className="whitespace-nowrap">
              Choose Different Image
            </Button>
          )}
          <Button
            variant="ghost"
            className="whitespace-nowrap"
            onClick={() => {
              setCrop({ x: 0, y: 0 });
              setZoom(1);
              setRotation(0);
              setFlipH(false);
              setFlipV(false);
            }}
          >
            <RotateCcw size={14} className="mr-1" /> Reset
          </Button>
          <Button loading={isSaving} onClick={() => void handleSave()} className="whitespace-nowrap">
            Save Photo
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Crop Area */}
        <div
          className="bg-bg-muted relative h-[350px] w-full overflow-hidden rounded-lg"
          style={{ transform: `scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})` }}
        >
          {imageUrl && (
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onCropComplete={handleCropComplete}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
            />
          )}
        </div>

        {/* Controls Row */}
        <div className="flex items-center gap-4">
          {/* Zoom Slider */}
          <div className="flex flex-1 items-center gap-3">
            <span className="text-text-muted text-xs">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="bg-border-default accent-primary-500 h-1.5 flex-1 cursor-pointer appearance-none rounded-full"
            />
            <span className="text-text-muted w-10 text-right text-xs">{zoom.toFixed(1)}x</span>
          </div>

          {/* Rotate & Flip Buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              title="Rotate 90°"
              className="text-text-secondary hover:bg-bg-muted rounded-sm p-1.5"
            >
              <RotateCw size={16} />
            </button>
            <button
              type="button"
              onClick={() => setFlipH((f) => !f)}
              title="Flip Horizontal"
              className="text-text-secondary hover:bg-bg-muted rounded-sm p-1.5"
            >
              <FlipHorizontal size={16} />
            </button>
            <button
              type="button"
              onClick={() => setFlipV((f) => !f)}
              title="Flip Vertical"
              className="text-text-secondary hover:bg-bg-muted rounded-sm p-1.5"
            >
              <FlipVertical size={16} />
            </button>
          </div>
        </div>

        {/* Rotation Slider */}
        <div className="flex items-center gap-3">
          <span className="text-text-muted text-xs">Rotate</span>
          <input
            type="range"
            min={0}
            max={360}
            step={1}
            value={rotation}
            onChange={(e) => setRotation(Number(e.target.value))}
            className="bg-border-default accent-primary-500 h-1.5 flex-1 cursor-pointer appearance-none rounded-full"
          />
          <span className="text-text-muted w-10 text-right text-xs">{rotation}°</span>
        </div>
      </div>
    </Modal>
  );
}

// ──────────────────────────────────────────────
//  Canvas-based crop utility
// ──────────────────────────────────────────────

async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  rotation = 0,
  flipH = false,
  flipV = false,
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas context");

  const outputSize = 512;

  // First, draw the full image rotated onto a temp canvas so we can crop from it
  const radians = (rotation * Math.PI) / 180;
  const { width: imgW, height: imgH } = image;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  const rotW = imgW * cos + imgH * sin;
  const rotH = imgW * sin + imgH * cos;

  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = rotW;
  tempCanvas.height = rotH;
  const tempCtx = tempCanvas.getContext("2d")!;

  tempCtx.translate(rotW / 2, rotH / 2);
  tempCtx.rotate(radians);
  tempCtx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  tempCtx.drawImage(image, -imgW / 2, -imgH / 2);

  // Now crop from the rotated canvas
  canvas.width = outputSize;
  canvas.height = outputSize;

  ctx.drawImage(
    tempCanvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputSize,
    outputSize,
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas is empty"));
      },
      "image/jpeg",
      0.9,
    );
  });
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", (err) => reject(err));
    img.crossOrigin = "anonymous";
    img.src = url;
  });
}
