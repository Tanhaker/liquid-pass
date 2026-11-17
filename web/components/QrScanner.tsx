"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";

/**
 * Scans a QR code with the device camera and hands back its text.
 *
 * Uses the browser's built-in BarcodeDetector (Chrome and Edge on Android,
 * desktop Chrome, Samsung Internet), so no library is shipped. Where it is
 * missing -- Safari, Firefox -- the button says so and the phone's own camera
 * app does the same job, since the code is an ordinary link.
 */

type Detector = { detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>> };
type DetectorCtor = new (opts: { formats: string[] }) => Detector;

export function QrScanner({ onResult, label = "SCAN THE VENUE'S CODE" }: { onResult: (text: string) => void; label?: string }) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setSupported("BarcodeDetector" in window && !!navigator.mediaDevices?.getUserMedia);
  }, []);

  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let done = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const Ctor = (window as unknown as { BarcodeDetector: DetectorCtor }).BarcodeDetector;
        const detector = new Ctor({ formats: ["qr_code"] });
        timer = setInterval(async () => {
          if (done || !video.current || video.current.readyState < 2) return;
          try {
            const codes = await detector.detect(video.current);
            if (codes[0]?.rawValue) {
              done = true;
              setOpen(false);
              onResult(codes[0].rawValue);
            }
          } catch {
            /* a frame that cannot be read is skipped */
          }
        }, 300);
      } catch (e) {
        const name = (e as { name?: string }).name;
        setError(name === "NotAllowedError" ? "Camera permission was refused." : "The camera could not be started.");
        setOpen(false);
      }
    })();
    return () => {
      done = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open, onResult]);

  if (supported === null) return null;
  if (!supported) {
    return (
      <p className="font-mono text-[11px] text-zincGrey">
        This browser cannot scan in the page. Point your phone&apos;s camera app at the venue&apos;s code instead; it opens
        this page with the code filled in.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {open ? (
        <div className="relative border border-uranium bg-black">
          <video ref={video} muted playsInline className="block w-full max-h-[360px] object-cover" />
          <div className="pointer-events-none absolute inset-8 border-2 border-uranium/70" />
          <button
            onClick={() => setOpen(false)}
            aria-label="Stop scanning"
            className="absolute right-2 top-2 flex items-center gap-1 bg-dark/90 border border-dark-border px-2 py-1 font-mono text-[11px] text-alabaster"
          >
            <X className="w-3.5 h-3.5" /> STOP
          </button>
        </div>
      ) : (
        <button
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
          className="inline-flex items-center gap-2 px-6 py-3 bg-uranium hover:bg-uranium-glow text-black font-mono text-xs font-extrabold uppercase tracking-wider shadow-grunge-uranium"
        >
          <Camera className="w-4 h-4" /> {label}
        </button>
      )}
      {error && <p className="font-mono text-[11px] text-red-400">{error}</p>}
    </div>
  );
}
