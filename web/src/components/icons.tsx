/** Hand-drawn 24px stroke icons, consistent 1.5 weight. No emoji, no icon fonts. */

const paths: Record<string, string> = {
  repo: "M4 3h13a2 2 0 0 1 2 2v16H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z M3 17h16 M7 7h8 M7 10h6",
  plus: "M12 5v14 M5 12h14",
  code: "M8 6l-6 6 6 6 M16 6l6 6-6 6",
  key: "M14 7a5 5 0 1 0-3 9l3 3h3v-3h3v-3l-3-3",
  folder: "M3 5h6l2 3h10v12H3z",
  file: "M5 3h9l5 5v13H5z M14 3v6h5",
  branch: "M6 3v13 M6 3a2 2 0 1 0 .01 0 M18 8a2 2 0 1 0 .01 0 M18 10a6 6 0 0 1-6 6H9",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M17 4a4 4 0 0 1 0 7 M22 21v-2a4 4 0 0 0-3-4",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16 M21 21l-4.3-4.3",
  issue: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18 M12 8h.01 M12 12v4",
  merge: "M6 3v13 M6 3a2.5 2.5 0 1 0 .01 0 M18 9a2.5 2.5 0 1 0 .01 0 M18 11.5c0 4-3 6.5-7 6.5",
  ci: "M22 12a10 10 0 1 1-10-10 M22 4L12 14l-3-3",
  box: "M21 8l-9-5-9 5v8l9 5 9-5z M3 8l9 5 9-5 M12 13v8",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14 3h-4l-.6 2.7a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2L10 21h4l.6-2.7a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5A7 7 0 0 0 19 12",
  bell: "M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9 M10.3 21a2 2 0 0 0 3.4 0",
  tag: "M20 12l-8 8-9-9V4h7z M7 7h.01",
  commit: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M3 12h6 M15 12h6",
  copy: "M9 9h11v11H9z M5 15H4V4h11v1",
  check: "M20 6L9 17l-5-5",
  x: "M18 6L6 18 M6 6l12 12",
  chevL: "M15 18l-6-6 6-6",
  chevR: "M9 18l6-6-6-6",
  chevD: "M6 9l6 6 6-6",
  ext: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6 M15 3h6v6 M10 14L21 3",
  trash: "M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6 M10 11v6 M14 11v6",
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3",
  book: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18 M12 7v5l3 2",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18 M3 12h18 M12 3a13.5 13.5 0 0 1 0 18 13.5 13.5 0 0 1 0-18",
  lock: "M5 11h14v10H5z M8 11V7a4 4 0 0 1 8 0v4",
  eye: "M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6",
  diff: "M8 3v18 M8 12h8 M16 3v4 M12 21h8",
  menu: "M3 6h18 M3 12h18 M3 18h18",
  home: "M3 10.5L12 3l9 7.5 M5 9v12h14V9",
  edit: "M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z",
  send: "M22 2L11 13 M22 2l-7 20-4-9-9-4z",
  alert: "M12 9v4 M12 17h.01 M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
};

export function Icon({ name, size }: { name: string; size?: number }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      width={size}
      height={size}
    >
      <path d={paths[name] || paths.repo} />
    </svg>
  );
}
