export type User = { id: number; name: string; email: string; picture: string | null };

export type EventItem = {
  id: number;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string;
  code: string;
  cover_url: string | null;
  is_owner: boolean;
};

export type Photo = {
  id: number;
  url: string;
  thumb_url: string;
  download_url: string;
  author: string;
  can_delete: boolean;
};

export type EventDetail = EventItem & { photos: Photo[] };
