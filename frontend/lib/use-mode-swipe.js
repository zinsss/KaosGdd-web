"use client";

import { useRef } from "react";

export function isModeSwipeInteractiveTarget(target) {
  return Boolean(target?.closest?.("a, button, input, textarea, select, option"));
}

export function getModeSwipeStep({ startX, startY, endX, endY, minDelta = 56, horizontalRatio = 1.35 }) {
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  if (absX < minDelta) return 0;
  if (absX <= absY * horizontalRatio) return 0;
  return deltaX < 0 ? 1 : -1;
}

export function useModeSwipe({ onStep }) {
  const touchStateRef = useRef({
    tracking: false,
    ignored: false,
    startX: 0,
    startY: 0,
  });

  function clearTouchTracking() {
    touchStateRef.current.tracking = false;
    touchStateRef.current.ignored = false;
  }

  function onTouchStart(event) {
    if (event.touches.length !== 1 || isModeSwipeInteractiveTarget(event.target)) {
      clearTouchTracking();
      touchStateRef.current.ignored = true;
      return;
    }

    const touch = event.touches[0];
    touchStateRef.current = {
      tracking: true,
      ignored: false,
      startX: touch.clientX,
      startY: touch.clientY,
    };
  }

  function onTouchEnd(event) {
    const state = touchStateRef.current;
    const touch = event.changedTouches?.[0];
    clearTouchTracking();
    if (!state.tracking || state.ignored || !touch) return;

    const step = getModeSwipeStep({
      startX: state.startX,
      startY: state.startY,
      endX: touch.clientX,
      endY: touch.clientY,
    });
    if (!step) return;
    onStep(step);
  }

  return {
    onTouchStart,
    onTouchEnd,
    onTouchCancel: clearTouchTracking,
  };
}
