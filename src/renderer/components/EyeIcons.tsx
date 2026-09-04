import React from 'react';

interface EyeIconProps {
  className?: string;
}

export function EyeOpenIcon({ className = 'w-4 h-4' }: EyeIconProps): React.JSX.Element {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M2.457 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.543 7-1.275 4.057-5.065 7-9.543 7-4.477 0-8.268-2.943-9.543-7z"
      />
    </svg>
  );
}

export function EyeClosedIcon({ className = 'w-4 h-4' }: EyeIconProps): React.JSX.Element {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13.875 18.001C13.341 17.994 12.832 18 12 18c-4.478 0-8.268-2.943-9.543-7a9.958 9.958 0 012.676-3.434M4.353 4.353l1.514 1.514M6.343 6.343L4.93 7.757M17.657 17.657l1.414 1.414M16.5 16.5L15 15M15.293 15.293A3.006 3.006 0 0112 15c-.437 0-.853.03-1.244.083m1.535 1.535A2.993 2.993 0 0112 18a3 3 0 01-3-3c0-.332.025-.654.072-.966"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M1 1l22 22"
      />
    </svg>
  );
}
