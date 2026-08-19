"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function isPlainLeftClick(event: MouseEvent) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export function NavigationSpinner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearTimer = setTimeout(() => {
      setIsNavigating(false);
    }, 0);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    return () => clearTimeout(clearTimer);
  }, [pathname, searchParams]);

  useEffect(() => {
    function clearNavigationState() {
      setIsNavigating(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }

    function handleClick(event: MouseEvent) {
      if (!isPlainLeftClick(event)) return;

      const target = event.target instanceof Element ? event.target.closest("a") : null;
      if (!(target instanceof HTMLAnchorElement)) return;
      if (target.target && target.target !== "_self") return;
      if (target.hasAttribute("download")) return;

      const nextUrl = new URL(target.href, window.location.href);
      if (nextUrl.origin !== window.location.origin) return;

      const currentUrl = new URL(window.location.href);
      if (nextUrl.pathname === currentUrl.pathname && nextUrl.search === currentUrl.search) return;

      setIsNavigating(true);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        setIsNavigating(false);
        timeoutRef.current = null;
      }, 8000);
    }

    document.addEventListener("click", handleClick, true);
    window.addEventListener("pageshow", clearNavigationState);

    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("pageshow", clearNavigationState);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (!isNavigating) return null;

  return (
    <div aria-live="polite" className="navigation-spinner" role="status">
      <span className="navigation-spinner__ring" />
      <span>Loading</span>
    </div>
  );
}
