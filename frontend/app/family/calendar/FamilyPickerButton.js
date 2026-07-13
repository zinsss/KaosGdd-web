"use client";

import { useEffect, useId, useRef, useState } from "react";

export function buildFamilyTimeOptions(stepMinutes = 10) {
  const options = [];
  for (let totalMinutes = 0; totalMinutes < 24 * 60; totalMinutes += stepMinutes) {
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    options.push({ value, label: value });
  }
  return options;
}

function FamilyPickerButton({ ariaLabel, children, className, onChange, options = [], type, value }) {
  const [open, setOpen] = useState(false);
  const controlId = useId();
  const fieldRef = useRef(null);
  const nativePicker = type === "date" || type === "time";

  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => fieldRef.current?.focus?.(), 0);
  }, [open]);

  function selectValue(nextValue) {
    onChange(nextValue);
    if (type !== "date") setOpen(false);
  }

  function closeOnEscape(event) {
    if (event.key === "Escape") setOpen(false);
  }

  function openNativePicker() {
    fieldRef.current?.focus?.();
    fieldRef.current?.showPicker?.();
  }

  if (nativePicker) {
    return (
      <span className={`${className} familyCalendarPickerNativeHost`} onClick={openNativePicker}>
        <span className="familyCalendarPickerButtonControl" aria-label={ariaLabel} role="button" tabIndex={-1}>
          {children}
        </span>
        <input
          aria-label={ariaLabel}
          className="familyCalendarNativePickerInput"
          onChange={(event) => onChange(event.target.value)}
          ref={fieldRef}
          step={type === "time" ? 600 : undefined}
          type={type}
          value={value}
        />
      </span>
    );
  }

  if (type === "select") {
    return (
      <span className={`${className} familyCalendarPickerSelectHost`}>
        <span className="familyCalendarPickerButtonControl" aria-hidden="true">
          {children}
        </span>
        <select
          aria-label={ariaLabel}
          className="familyCalendarPickerNativeSelect"
          onChange={(event) => onChange(event.target.value)}
          value={String(value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </span>
    );
  }

  return (
    <span className={`${className} familyCalendarPickerFallbackHost`} onKeyDown={closeOnEscape}>
      <button
        aria-controls={open ? controlId : undefined}
        aria-expanded={open}
        aria-haspopup={type === "date" ? "dialog" : "listbox"}
        aria-label={ariaLabel}
        className="familyCalendarPickerButtonControl"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {children}
      </button>
      {open ? (
        <span className="familyCalendarPickerFallbackPanel familyCalendarPickerFallbackPanelMenu" id={controlId}>
          <select
            aria-label={ariaLabel}
            className="familyCalendarPickerFallbackSelect"
            onChange={(event) => selectValue(event.target.value)}
            ref={fieldRef}
            value={value}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </span>
      ) : null}
    </span>
  );
}

export function FamilyDatePickerButton({ ariaLabel, children, className, onChange, value }) {
  return (
    <FamilyPickerButton ariaLabel={ariaLabel} className={className} onChange={onChange} type="date" value={value}>
      {children}
    </FamilyPickerButton>
  );
}

export function FamilyTimePickerButton({ ariaLabel, children, className, onChange, value }) {
  return (
    <FamilyPickerButton
      ariaLabel={ariaLabel}
      className={className}
      onChange={onChange}
      options={buildFamilyTimeOptions()}
      type="time"
      value={value}
    >
      {children}
    </FamilyPickerButton>
  );
}

export function FamilySelectPickerButton({ ariaLabel, children, className, onChange, options, value }) {
  return (
    <FamilyPickerButton
      ariaLabel={ariaLabel}
      className={className}
      onChange={onChange}
      options={options}
      type="select"
      value={String(value)}
    >
      {children}
    </FamilyPickerButton>
  );
}
