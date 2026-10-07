import { useCallback, useRef, useState } from "react";

// Latches on first intersection and never flips back: this exists to gate
// *starting* work for an element (a card's preview fetch), and "un-starting"
// one once the player scrolls past would only mean paying for it again when
// they scroll back. rootMargin pre-loads a screenful ahead so cards are
// already filled in by the time they're actually looked at.
export function useInView<T extends Element>(rootMargin = "300px"): [(node: T | null) => void, boolean] {
  const [inView, setInView] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const ref = useCallback((node: T | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!node || inView) return;
    // No observer (non-browser render, very old webview) - fall back to
    // "everything is visible" rather than to "nothing ever loads".
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setInView(true);
      observer.disconnect();
    }, { rootMargin });
    observer.observe(node);
    observerRef.current = observer;
  }, [inView, rootMargin]);

  return [ref, inView];
}
