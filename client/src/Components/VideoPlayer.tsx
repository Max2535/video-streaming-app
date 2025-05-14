import React, { useRef, useEffect } from "react";
import videojs from "video.js";
import "video.js/dist/video-js.css";
import type Player from "video.js/dist/types/player";

interface VideoPlayerProps {
  src: string;
  poster?: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, poster }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<Player | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const videoElement = videoRef.current;

      if (!videoElement) {
        console.warn("❌ <video> element not found in DOM");
        return;
      }

      console.log("🎬 Initializing Video.js player with src:", src);

      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }

      playerRef.current = videojs(videoElement, {
        controls: true,
        autoplay: false,
        preload: "auto",
        fluid: true,
        poster,
        sources: [
          {
            src,
            type: "video/mp4",
          },
        ],
        controlBar: {
          volumePanel: { inline: false },
          fullscreenToggle: true,
          captionsButton: true,
          subtitlesButton: true,
          remainingTimeDisplay: true,
          playbackRateMenuButton: true, // ถ้าเปิด playback speed
          pictureInPictureToggle: true, // ถ้าจะใช้ PIP
          children: [
            "playToggle",
            "volumePanel",
            "currentTimeDisplay",
            "timeDivider",
            "durationDisplay",
            "progressControl",
            "remainingTimeDisplay",
            "playbackRateMenuButton",
            "chaptersButton",
            "descriptionsButton",
            "subsCapsButton",
            "audioTrackButton",
            "fullscreenToggle",
          ],
        },
      });

      playerRef.current.on("error", () => {
        console.error(
          "❌ Video.js playback error:",
          playerRef.current?.error()
        );
      });
    }, 0); // ✅ delay 1 tick

    return () => {
      clearTimeout(timeout);
      if (playerRef.current) {
        console.log("🧹 Disposing Video.js player");
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [src, poster]);

  return (
    <div data-vjs-player className="w-full max-w-[800px]">
      <video
        key={src} // ✅ force re-mount when src changes
        ref={videoRef}
        className="video-js vjs-default-skin w-full"
        playsInline
      />
    </div>
  );
};

export default VideoPlayer;
