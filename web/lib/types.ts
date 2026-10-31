export type User = { id: number; name: string; email: string; picture: string | null };

export type EventItem = {
  id: number;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string;
  code: string;
  cover_url: string | null;
  preview_url: string | null; // the cover, else the newest photo
  is_owner: boolean;
};

export type Photo = {
  id: number;
  kind: "image" | "video";
  url: string;
  thumb_url: string | null; // null: a video the browser couldn't take a poster frame from
  download_url: string;
  author: string;
  can_delete: boolean;
};

export type EventDetail = EventItem & { photos: Photo[] };

export type SearchResult = { results: { id: number; score: number }[] };
export type DuplicatesResult = { groups: { keep: number; drop: number[] }[]; hidden: number };
