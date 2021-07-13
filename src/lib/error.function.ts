export function stackTrace() {
  const err = new Error();
  return err.stack;
}
