import React from "react";

export type HaloState = "listening" | "evaluating" | "speaking" | "celebrating";

interface ListeningHaloProps {
  state: HaloState;
  size?: number;
  label?: string;
}

export default function ListeningHalo({ state, size = 56, label = "AI" }: ListeningHaloProps) {
  return (
    <div className={`halo-container halo-state-${state}`} style={{ width: size, height: size }}>
      <div className="halo-ring" />
      <div className={`ai-orb ${state}`} style={{ width: size, height: size }}>
        <span>{label}</span>
      </div>
    </div>
  );
}
