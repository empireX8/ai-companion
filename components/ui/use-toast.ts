export function useToast() {
  return { toast: (opts: unknown) => console.log("Toast:", opts) };
}
