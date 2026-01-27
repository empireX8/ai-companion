import * as React from "react";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => (
    <input
      ref={ref}
      className={`w-full rounded-md border border-gray-300 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 ${className}`}
      {...props}
    />
  )
);
Input.displayName = "Input";
