type Props = {
  text: string;
  label: string;
  onCopy: (text: string) => void;
};

export function CopyButton({ text, label, onCopy }: Props) {
  return (
    <button className="copy-btn" title={label} aria-label={label} onClick={() => onCopy(text)}>
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <rect x="7" y="7" width="10" height="10" rx="2" />
        <path d="M4 13V5a2 2 0 0 1 2-2h8" />
      </svg>
    </button>
  );
}
