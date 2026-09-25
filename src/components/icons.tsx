import type { SVGProps } from "react";

function Icon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props} />;
}

export const LibraryIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M3 16.5V6l4-2.5 3 2V16.5" />
    <path d="M10 5.5l3-2 4 2.5v10.5" />
    <path d="M3 16.5h14" />
  </Icon>
);

export const ChevronLeftIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M12.5 4l-5.5 6 5.5 6" />
  </Icon>
);

export const ChevronRightIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M7.5 4l5.5 6-5.5 6" />
  </Icon>
);

export const MinusIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M4 10h12" />
  </Icon>
);

export const PlusIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M10 4v12M4 10h12" />
  </Icon>
);

export const FitWidthIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M3 6.5V3.5h4M17 6.5V3.5h-4M3 13.5v3h4M17 13.5v3h-4" />
  </Icon>
);

export const FitPageIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="4" y="2.5" width="12" height="15" rx="1.2" />
  </Icon>
);

export const SearchIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="8.5" cy="8.5" r="5.5" />
    <path d="M16.5 16.5l-4-4" />
  </Icon>
);

export const CloseIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M5 5l10 10M15 5L5 15" />
  </Icon>
);

export const CursorIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M5 3l11 6.5-4.5 1L14 16l-2 1-2.5-5.5L6 14.5V3z" />
  </Icon>
);

export const NoteIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="3.5" y="3.5" width="13" height="13" rx="2" />
    <path d="M6.5 8h7M6.5 11.5h4.5" />
  </Icon>
);

export const PencilIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M4 16l0.8-3.6L12.4 4.8l2.8 2.8-7.6 7.6L4 16z" />
    <path d="M11 6.5l2.5 2.5" />
  </Icon>
);

export const EraserIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M5.5 12.5l6-6 4.5 4.5-4 4h-4.5l-2-2z" />
    <path d="M7.5 16h9" />
  </Icon>
);

export const DownloadIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M10 3v9.5M6 9l4 4 4-4" />
    <path d="M4 16.5h12" />
  </Icon>
);

export const ExternalLinkIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M8.5 5H5a1.5 1.5 0 0 0-1.5 1.5V15A1.5 1.5 0 0 0 5 16.5h8.5A1.5 1.5 0 0 0 15 15v-3.5" />
    <path d="M11.5 3.5H16.5V8.5" />
    <path d="M16.5 3.5L9 11" />
  </Icon>
);

export const LayersIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M10 3.5l6.5 3.5L10 10.5 3.5 7 10 3.5z" />
    <path d="M3.5 10.5L10 14l6.5-3.5" />
    <path d="M3.5 13.8L10 17.3l6.5-3.5" />
  </Icon>
);

export const CommentsIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="2.5" y="3.5" width="15" height="13" rx="1.5" />
    <path d="M11 3.5v13" />
    <path d="M13 7h2.5M13 10h2.5M13 13h1.5" />
  </Icon>
);
