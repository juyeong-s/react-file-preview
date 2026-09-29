import type { FormatOptions, RendererDefinition } from '../../core/types';

export const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];

export interface ImageOptions extends FormatOptions {
  /** Fit modes may scale small images above 100%. */
  upscale?: boolean;
  /** Background behind transparent images. */
  background?: 'checker' | 'none';
  /** Drag to pan when the image is larger than the viewport. */
  pan?: boolean;
}

export function imageRenderer(options: ImageOptions = {}): RendererDefinition<ImageOptions> {
  return {
    name: 'image',
    test: ({ ext }) => IMAGE_EXTENSIONS.includes(ext),
    capabilities: { zoom: true, rotate: true, print: true },
    source: 'url',
    defaults: {
      upscale: false,
      background: 'checker',
      pan: true,
      ...options,
      zoomOptions: { initial: 'page-fit', max: 10, wheel: 'always', doubleClick: 'toggle-fit', ...options.zoomOptions },
    },
    load: () => import('./ImageView'),
  };
}
