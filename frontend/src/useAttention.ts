import { useCallback, useEffect, useRef, useState } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export interface AttentionSignal {
  face_present: boolean;
  looking_away: boolean;
  attention_score: number;
}

export function useAttention(onSignal: (signal: AttentionSignal) => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState(100);
  const scoreRef = useRef(100);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const callbackRef = useRef(onSignal);
  callbackRef.current = onSignal;

  const stop = useCallback(() => {
    videoRef.current?.srcObject &&
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
    setEnabled(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera access is unavailable in this browser.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: "user" },
        audio: false,
      });
      if (!videoRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error("Camera preview is not ready.");
      }
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
      );
      landmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numFaces: 1,
      });
      setEnabled(true);
      return true;
    } catch (reason) {
      stop();
      setError(reason instanceof Error ? reason.message : "Could not start the camera.");
      return false;
    }
  }, [stop]);

  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    let lastSent = 0;
    const tick = () => {
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;
      if (video && landmarker && video.readyState >= 2) {
        const result = landmarker.detectForVideo(video, performance.now());
        const face = result.faceLandmarks[0];
        let nextScore = 25;
        let lookingAway = true;
        if (face) {
          const nose = face[1];
          lookingAway = nose.x < 0.35 || nose.x > 0.65 || nose.y < 0.25 || nose.y > 0.72;
          nextScore = lookingAway ? 58 : 92;
        }
        const smoothed = Math.round(scoreRef.current * 0.8 + nextScore * 0.2);
        scoreRef.current = smoothed;
        setScore(smoothed);
        if (Date.now() - lastSent > 3000) {
          callbackRef.current({
            face_present: Boolean(face),
            looking_away: lookingAway,
            attention_score: smoothed,
          });
          lastSent = Date.now();
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [enabled]);

  useEffect(() => stop, [stop]);
  return { videoRef, enabled, score, error, start, stop };
}
