"use client";

import { useEffect, useRef } from "react";

const DEFAULT_MODE_SWIPE_STATE = {
  tracking: false,
  ignored: false,
  axis: null,
  handled: false,
  startX: 0,
  startY: 0,
};

export function isModeSwipeInteractiveTarget(target) {
  return Boolean(target?.closest?.("a, button, input, textarea, select, option"));
}

export function createModeSwipeState(overrides = {}) {
  return { ...DEFAULT_MODE_SWIPE_STATE, ...overrides };
}

export function getModeSwipeMoveResult({
  state,
  currentX,
  currentY,
  axisThreshold = 10,
  horizontalRatio = 1.35,
  stepThreshold = 56,
}) {
  if (!state?.tracking || state.ignored || state.handled) {
    return { nextState: state || createModeSwipeState(), step: 0 };
  }

  const deltaX = currentX - state.startX;
  const deltaY = currentY - state.startY;
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);
  let axis = state.axis;

  if (!axis) {
    if (absX < axisThreshold && absY < axisThreshold) {
      return { nextState: state, step: 0 };
    }

    if (absX > absY * horizontalRatio && absX > axisThreshold) {
      axis = "x";
    } else if (absY > absX) {
      axis = "y";
    } else {
      return { nextState: state, step: 0 };
    }
  }

  if (axis !== "x" || absX < stepThreshold) {
    return { nextState: { ...state, axis }, step: 0 };
  }

  return {
    nextState: { ...state, axis, handled: true, tracking: false },
    step: deltaX < 0 ? 1 : -1,
  };
}

export function useModeSwipe({ onStep }) {
  const swipeAreaRef = useRef(null);
  const touchStateRef = useRef(createModeSwipeState());
  const onStepRef = useRef(onStep);

  useEffect(() => {
    onStepRef.current = onStep;
  }, [onStep]);

  function clearTouchTracking() {
    touchStateRef.current = createModeSwipeState();
  }

  function onTouchStart(event) {
    if (event.touches.length !== 1 || isModeSwipeInteractiveTarget(event.target)) {
      touchStateRef.current = createModeSwipeState({ ignored: true });
      return;
    }

    const touch = event.touches[0];
    touchStateRef.current = createModeSwipeState({
      tracking: true,
      ignored: false,
      startX: touch.clientX,
      startY: touch.clientY,
    });
  }

  function onTouchMove(event) {
    if (event.touches.length !== 1) {
      clearTouchTracking();
      return;
    }
    const touch = event.touches[0];
    const result = getModeSwipeMoveResult({
      state: touchStateRef.current,
      currentX: touch.clientX,
      currentY: touch.clientY,
    });
    touchStateRef.current = result.nextState;
    if (result.step) onStepRef.current?.(result.step);
  }

  useEffect(() => {
    const element = swipeAreaRef.current;
    if (!element) return undefined;

    element.addEventListener("touchstart", onTouchStart, { passive: true });
    element.addEventListener("touchmove", onTouchMove, { passive: true });
    element.addEventListener("touchend", clearTouchTracking, { passive: true });
    element.addEventListener("touchcancel", clearTouchTracking, { passive: true });

    return () => {
      element.removeEventListener("touchstart", onTouchStart);
      element.removeEventListener("touchmove", onTouchMove);
      element.removeEventListener("touchend", clearTouchTracking);
      element.removeEventListener("touchcancel", clearTouchTracking);
    };
  }, []);

  return {
    ref: swipeAreaRef,
    onTouchStart,
    onTouchMove,
    onTouchEnd: clearTouchTracking,
    onTouchCancel: clearTouchTracking,
  };
}
