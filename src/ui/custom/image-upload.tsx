"use client";

import { Camera, Upload, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";

import { Loader } from "./loader";
import { SVG } from "./svg";

interface ImageUploadProps {
  aspectRatio?: "square" | "tall" | "wide";
  className?: string;
  containerClassName?: string;
  fallbackIcon?: React.ReactNode;
  height?: string;
  id: string;
  initialImage?: null | string;
  isLoading?: boolean;
  onImageChange?: (image: null | string, file?: File | null) => void;
  width?: string;
}

export function ImageUpload({
  aspectRatio = "square",
  className,
  containerClassName,
  fallbackIcon = <Upload className="h-8 w-8 text-muted-foreground" />,
  height = "h-32",
  id,
  initialImage,
  isLoading = false,
  onImageChange,
  width = "w-32",
}: ImageUploadProps) {
  const [image, setImage] = useState<null | string>(initialImage ?? null);
  const [isSvg, setIsSvg] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check if the file is an SVG
      const isSvgFile = file.type === "image/svg+xml";
      setIsSvg(isSvgFile);

      const reader = new FileReader();
      reader.onload = (e) => {
        const newImage = e.target?.result as string;
        setImage(newImage);
        onImageChange?.(newImage, file);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImage(null);
    setIsSvg(false);
    onImageChange?.(null, null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  // Determine container aspect ratio class
  const aspectRatioClass = {
    square: "aspect-square",
    tall: "aspect-[3/4]",
    wide: "aspect-[4/3]",
  }[aspectRatio];

  return (
    <div className={cn("flex", containerClassName)}>
      <div className="relative inline-block">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              initial={{ opacity: 0, scale: 0.8 }}
              key="loading"
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <div
                className={cn(
                  width,
                  height,
                  aspectRatioClass,
                  "flex items-center justify-center rounded-md bg-muted"
                )}
              >
                <Loader size="xl" />
              </div>
            </motion.div>
          ) : (
            <motion.div
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              initial={{ opacity: 0, scale: 0.8 }}
              key={image || "empty"}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <div className="group relative inline-block">
                <Button
                  aria-label="Upload image"
                  className={cn(
                    width,
                    height,
                    aspectRatioClass,
                    "flex cursor-pointer items-center justify-center overflow-hidden rounded-md border-2 border-accent border-dashed transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                    className
                  )}
                  onClick={handleImageClick}
                  type="button"
                  variant="ghost"
                >
                  {(() => {
                    if (!image) {
                      return (
                        <div className="flex flex-col items-center justify-center gap-2 p-4">
                          {fallbackIcon}
                          <span className="text-muted-foreground text-xs">
                            Upload
                          </span>
                        </div>
                      );
                    }
                    if (isSvg) {
                      return (
                        <SVG
                          alt="Uploaded SVG"
                          className="h-full w-full p-2 text-foreground"
                          src={image}
                        />
                      );
                    }
                    return (
                      <Image
                        alt="Uploaded image"
                        className="h-full w-full object-contain"
                        height={1000}
                        src={image}
                        unoptimized
                        width={1000}
                      />
                    );
                  })()}
                  <div className="absolute inset-0 flex items-center justify-center bg-background/70 opacity-0 transition-opacity duration-300 hover:opacity-100">
                    <Camera className="h-8 w-8 text-foreground" />
                  </div>
                </Button>
                {image && (
                  <Button
                    aria-label="Remove image"
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full opacity-0 shadow-sm transition-opacity duration-200 group-hover:opacity-100"
                    onClick={handleRemoveImage}
                    size="icon"
                    variant="destructive"
                  >
                    <X className="h-2 w-2" />
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <Input
          accept="image/*,.svg"
          className="hidden"
          data-testid="image-input"
          id={id}
          onChange={handleFileChange}
          ref={fileInputRef}
          type="file"
        />
      </div>
    </div>
  );
}
