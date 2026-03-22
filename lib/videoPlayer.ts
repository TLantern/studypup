import React, { createContext, useContext } from 'react'
import { useVideoPlayer } from 'expo-video'

const VideoPlayerContext = createContext<ReturnType<typeof useVideoPlayer> | null>(null)

export function VideoPlayerProvider({ children }: { children: React.ReactNode }) {
  const player = useVideoPlayer(require('../assets/demovid.mp4'), (p) => {
    p.loop = false
    p.muted = false
  })
  return React.createElement(VideoPlayerContext.Provider, { value: player }, children)
}

export function useSharedVideoPlayer() {
  const ctx = useContext(VideoPlayerContext)
  if (!ctx) throw new Error('useSharedVideoPlayer must be used within VideoPlayerProvider')
  return ctx
}