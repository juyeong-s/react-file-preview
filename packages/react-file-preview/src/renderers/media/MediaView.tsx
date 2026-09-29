import type { RendererProps } from '../../core/types';
import { formatBytes } from '../../core/utils';
import { defaultIcons } from '../../ui/icons';
import { VIDEO_EXTENSIONS, type MediaOptions } from './index';

export default function MediaView({ file, options, bridge, messages }: RendererProps<MediaOptions>) {
  const isVideo = VIDEO_EXTENSIONS.includes(file.ext) || file.mime.startsWith('video/');
  const common = {
    src: file.url,
    controls: true,
    autoPlay: options.autoPlay,
    loop: options.loop,
    muted: options.muted,
    preload: 'metadata' as const,
    onLoadedMetadata: () => bridge.ready(),
    onError: () => bridge.fail(new Error(messages.mediaError)),
  };

  if (isVideo) {
    return (
      <div className="fp-media">
        <video className="fp-video" playsInline poster={options.poster} {...common} />
      </div>
    );
  }

  return (
    <div className="fp-media">
      <div className="fp-audio-card">
        <div className="fp-audio-icon">{defaultIcons.file}</div>
        <div className="fp-audio-name" title={file.name}>
          {file.name}
        </div>
        {file.size != null && <div className="fp-audio-size">{formatBytes(file.size)}</div>}
        <audio className="fp-audio" {...common} />
      </div>
    </div>
  );
}
