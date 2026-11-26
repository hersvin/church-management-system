import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useEffect, useState } from "react";

/**
 * One shared player for catalog previews (about 30 seconds each), so starting a preview stops the last one.
 * Only https preview links from the catalog are ever played.
 */
export function usePreview() {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (status.didJustFinish) setUrl(null);
  }, [status.didJustFinish]);

  function toggle(next: string) {
    if (!next.startsWith("https://")) return;
    if (url === next && status.playing) {
      player.pause();
      setUrl(null);
      return;
    }
    player.replace({ uri: next });
    player.play();
    setUrl(next);
  }

  function stop() {
    player.pause();
    setUrl(null);
  }

  return {
    playingUrl: status.playing || status.isBuffering ? url : null,
    toggle,
    stop,
  };
}
