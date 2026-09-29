import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';
import { useController, useViewerSelector } from '../core/context';
import { cx } from '../core/utils';
import type { StateClassName } from './parts';

export interface ThumbnailRenderProps {
  page: number;
  /** Image URL, `null` while it is being drawn. */
  src: string | null;
  active: boolean;
  select(): void;
}

export interface ThumbnailsProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Thumbnail width in CSS pixels. */
  width?: number;
  renderItem?: (props: ThumbnailRenderProps) => ReactNode;
  itemClassName?: StateClassName<{ active: boolean }>;
}

function Thumb({
  page,
  width,
  root,
  renderItem,
  itemClassName,
}: {
  page: number;
  width: number;
  root: HTMLElement | null;
  renderItem?: ThumbnailsProps['renderItem'];
  itemClassName?: ThumbnailsProps['itemClassName'];
}) {
  const controller = useController();
  const active = useViewerSelector((s) => s.page === page);
  const rotation = useViewerSelector((s) => s.rotation);
  const [src, setSrc] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(!!entry?.isIntersecting), {
      root,
      rootMargin: '200px 0px',
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [root]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    controller.actions
      .getThumbnail(page, width)
      .then((url) => !cancelled && setSrc(url))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [visible, page, width, rotation, controller]);

  useEffect(() => {
    // Scroll only the thumbnail list, never the page around the viewer.
    const el = ref.current;
    if (!active || !el || !root) return;
    const top = el.offsetTop; // .fp-thumbnails is position: relative
    const bottom = top + el.offsetHeight;
    if (top < root.scrollTop) root.scrollTop = top;
    else if (bottom > root.scrollTop + root.clientHeight) root.scrollTop = bottom - root.clientHeight;
  }, [active, root]);

  const select = () => controller.actions.goToPage(page);

  return (
    <div ref={ref} className="fp-thumbnail-slot">
      {renderItem ? (
        renderItem({ page, src, active, select })
      ) : (
        <button
          type="button"
          className={cx(
            'fp-thumbnail',
            typeof itemClassName === 'function' ? itemClassName({ active }) : itemClassName,
          )}
          data-active={active ? '' : undefined}
          aria-current={active ? 'page' : undefined}
          aria-label={`${controller.messages.page} ${page}`}
          onClick={select}
        >
          <span className="fp-thumbnail-image" style={{ width, minHeight: src ? undefined : width * 1.3 }}>
            {src && <img src={src} alt="" width={width} draggable={false} />}
          </span>
          <span className="fp-thumbnail-label">{page}</span>
        </button>
      )}
    </div>
  );
}

/** Page thumbnails (PDF). Renders nothing for formats without thumbnails. */
export function Thumbnails({ width = 120, renderItem, itemClassName, className, ...rest }: ThumbnailsProps) {
  const controller = useController();
  const supported = useViewerSelector((s) => s.capabilities.thumbnails);
  const pageCount = useViewerSelector((s) => s.pageCount);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  if (!supported) return null;

  return (
    <div
      ref={setRoot}
      className={cx('fp-thumbnails', className)}
      aria-label={controller.messages.thumbnails}
      {...rest}
    >
      {root &&
        Array.from({ length: pageCount }, (_, i) => (
          <Thumb
            key={i}
            page={i + 1}
            width={width}
            root={root}
            renderItem={renderItem}
            itemClassName={itemClassName}
          />
        ))}
    </div>
  );
}
