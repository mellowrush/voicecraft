type Props = { message: string | null };

export function Toast({ message }: Props) {
  return (
    <div className={`toast${message ? " show" : ""}`} role="status">
      <span className="toast-dot" />
      <span>{message}</span>
    </div>
  );
}
