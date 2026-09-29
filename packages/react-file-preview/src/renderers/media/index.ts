import type { FormatOptions, RendererDefinition } from '../../core/types';

export const VIDEO_EXTENSIONS = ['mp4', 'm4v', 'webm', 'mov'];
export const AUDIO_EXTENSIONS = ['mp3', 'wav', 'm4a', 'ogg', 'oga', 'aac', 'flac'];

export interface MediaOptions extends FormatOptions {
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  /** Passed to the `<video>` element. */
  poster?: string;
}

export function mediaRenderer(options: MediaOptions = {}): RendererDefinition<MediaOptions> {
  return {
    name: 'media',
    test: ({ ext }) => VIDEO_EXTENSIONS.includes(ext) || AUDIO_EXTENSIONS.includes(ext),
    capabilities: {},
    source: 'url',
    defaults: { autoPlay: false, loop: false, muted: false, ...options },
    load: () => import('./MediaView'),
  };
}
