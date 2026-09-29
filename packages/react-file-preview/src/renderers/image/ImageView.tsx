import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useViewerSelector } from '../../core/context';
import type { RendererProps } from '../../core/types';
import { printInIframe } from '../../core/utils';
import { pageGap } from '../shared';
import type { ImageOptions } from './index';

function escapeAttr(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export default function ImageView({ file, options, bridge, messages }: RendererProps<ImageOptions>) {
  const zoom = useViewerSelector((s) => s.zoom);
  const rotation = useViewerSelector((s) => s.rotation);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [panning, setPanning] = useState(false);
  const drag = useRef<{ x: number; y: number } | null>(null);
  // Read by the fit handler; a ref keeps the registered handler stable.
  const rotationRef = useRef(rotation);
  rotationRef.current = rotation;

  useEffect(() => {
    if (!natural) return;
    return bridge.register({
      getFitScale: (mode, box) => {
        const rotated = rotationRef.current % 180 !== 0;
        const w = rotated ? natural.height : natural.width;
        const h = rotated ? natural.width : natural.height;
        const gap = pageGap(bridge.getScrollElement());
        const byWidth = (box.width - gap * 2) / w;
        const scale = mode === 'page-width' ? byWidth : Math.min(byWidth, (box.height - gap * 2) / h);
        return options.upscale ? scale : Math.min(1, scale);
      },
      print: () =>
        printInIframe({
          html: `<!doctype html><title>${escapeAttr(file.name)}</title><style>@page{margin:0}html,body{margin:0;height:100%}body{display:flex;align-items:center;justify-content:center}img{max-width:100%;max-height:100vh;transform:rotate(${rotationRef.current}deg)}</style><img src="${escapeAttr(file.url)}">`,
        }),
    });
  }, [natural, bridge, options.upscale, file]);

  useEffect(() => {
    bridge.invalidateFit();
  }, [rotation, bridge]);

  const width = (natural?.width ?? 0) * zoom;
  const height = (natural?.height ?? 0) * zoom;
  const rotated = rotation % 180 !== 0;

  const onPointerDown = (e: ReactPointerEvent) => {
    const el = bridge.getScrollElement();
    if (!options.pan || e.button !== 0 || e.pointerType === 'touch' || !el) return;
    if (el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight) return;
    drag.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setPanning(true);
    e.preventDefault();
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const el = bridge.getScrollElement();
    if (!drag.current || !el) return;
    el.scrollLeft -= e.clientX - drag.current.x;
    el.scrollTop -= e.clientY - drag.current.y;
    drag.current = { x: e.clientX, y: e.clientY };
  };
  const endPan = () => {
    drag.current = null;
    setPanning(false);
  };

  return (
    <div
      className="fp-center"
      data-panning={panning ? '' : undefined}
      data-pannable={options.pan ? '' : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPan}
      onPointerCancel={endPan}
    >
      <div
        className="fp-image-box"
        data-background={options.background}
        style={
          natural
            ? { width: rotated ? height : width, height: rotated ? width : height }
            : { visibility: 'hidden' }
        }
      >
        <img
          className="fp-image"
          src={file.url}
          alt={file.name}
          draggable={false}
          style={
            natural
              ? { width, height, transform: `translate(-50%, -50%) rotate(${rotation}deg)` }
              : undefined
          }
          onLoad={(e) => {
            const img = e.currentTarget;
            // SVGs without intrinsic size report 0; give them a sensible box.
            setNatural({ width: img.naturalWidth || 512, height: img.naturalHeight || 512 });
            requestAnimationFrame(() => bridge.ready());
          }}
          onError={() => bridge.fail(new Error(messages.errorTitle))}
        />
      </div>
    </div>
  );
}
