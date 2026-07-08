"use client";

import { useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Play, Pause, Maximize2, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { proofCards } from "@/data/site";
import type { LucideIcon } from "lucide-react";

const VIDEO_PATH = "/AIRIS-CLI/proof/airis-install-demo.mp4";

function ProofCard({ title, description, icon: Icon, index }: { title: string; description: string; icon: LucideIcon; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ delay: 0.1 + index * 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card className="glass-card hover-lift h-full border-border/60 bg-card/60">
        <CardHeader>
          <div className="feature-icon mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-blue-400/20">
            <Icon className="h-5 w-5 text-blue-400" />
          </div>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription className="text-sm leading-6">{description}</CardDescription>
        </CardHeader>
      </Card>
    </motion.div>
  );
}

export function VideoProof() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current || !videoRef.current.duration) return;
    setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100);
  }, []);

  const handleVideoEnd = useCallback(() => {
    setIsPlaying(false);
    setProgress(0);
  }, []);

  return (
    <div className="space-y-10">
      {/* Video Player */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="overflow-hidden rounded-2xl border border-border/60 bg-black shadow-2xl"
      >
        <div className="relative video-container">
          <video
            ref={videoRef}
            src={VIDEO_PATH}
            muted={isMuted}
            loop={false}
            playsInline
            preload="metadata"
            className="w-full aspect-video object-cover"
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleVideoEnd}
            onClick={togglePlay}
            aria-label="AIRIS CLI installation demo video"
          />

          {/* Video Controls Overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-12">
            {/* Progress Bar */}
            <div className="mb-3 h-1 w-full overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-blue-400 transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/25"
                  aria-label={isPlaying ? "Pause video" : "Play video"}
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={toggleMute}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/25"
                  aria-label={isMuted ? "Unmute video" : "Mute video"}
                >
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
              </div>
              <Badge className="bg-white/10 text-xs text-white/70 backdrop-blur-sm">
                AIRIS Install Demo
              </Badge>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Proof Cards */}
      <div className="grid gap-5 sm:grid-cols-3">
        {proofCards.map((card, i) => (
          <ProofCard key={card.title} {...card} index={i} />
        ))}
      </div>
    </div>
  );
}
