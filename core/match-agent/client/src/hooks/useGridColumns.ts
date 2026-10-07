import { RefObject, useEffect, useState } from "react";

// How many columns a CSS grid currently resolves to. The card grid's column
// count is decided by the browser (repeat(auto-fill, ...) against whatever
// width the panel ended up with), not by us, so the only honest way to move a
// cursor up/down a row is to read it back off the resolved style and re-read
// it whenever the element resizes.
export function useGridColumns(ref: RefObject<HTMLElement | null>): number {
  const [columns, setColumns] = useState(1);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const template = getComputedStyle(element).gridTemplateColumns;
      // "none" for a grid with no tracks yet (empty/hidden) - keep 1 so
      // row movement degrades to single-step rather than to zero-step.
      const count = template === "none" ? 0 : template.split(" ").filter(Boolean).length;
      setColumns(Math.max(count, 1));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return columns;
}
