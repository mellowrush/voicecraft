import { wordDiff } from "../lib/diff";

type Props = { before: string; after: string };

export function DiffView({ before, after }: Props) {
  const segments = wordDiff(before, after);
  return (
    <p className="result-diff">
      {segments.map((seg, i) =>
        seg.type === "same" ? (
          <span key={i}>{seg.text}</span>
        ) : (
          <span key={i} className={seg.type === "add" ? "diff-add" : "diff-del"}>
            {seg.text}
          </span>
        ),
      )}
    </p>
  );
}
