import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode, type Ref } from 'react';
import { cx } from '../core/utils';

type AnyProps = Record<string, any>;

function mergeRefs<T>(...refs: (Ref<T> | undefined)[]) {
  return (value: T | null) => {
    for (const ref of refs) {
      if (typeof ref === 'function') ref(value);
      else if (ref) (ref as { current: T | null }).current = value;
    }
  };
}

/**
 * Renders its only child with the slot's props merged in (handlers are chained,
 * classes joined, styles merged). Powers the `asChild` prop.
 */
export function Slot({ children, ref, ...slotProps }: AnyProps & { children?: ReactNode }) {
  const child = Children.only(children);
  if (!isValidElement(child)) return null;
  const element = child as ReactElement<AnyProps>;
  const childProps = element.props;
  const merged: AnyProps = { ...slotProps, ...childProps };

  for (const key of Object.keys(slotProps)) {
    const slotValue = slotProps[key];
    const childValue = childProps[key];
    if (/^on[A-Z]/.test(key) && typeof slotValue === 'function' && typeof childValue === 'function') {
      merged[key] = (...args: unknown[]) => {
        childValue(...args);
        slotValue(...args);
      };
    } else if (key === 'className') {
      merged[key] = cx(slotValue, childValue);
    } else if (key === 'style') {
      merged[key] = { ...slotValue, ...childValue };
    }
  }
  const childRef = (childProps as { ref?: Ref<unknown> }).ref;
  if (ref || childRef) merged.ref = mergeRefs(ref, childRef);
  return cloneElement(element, merged);
}
