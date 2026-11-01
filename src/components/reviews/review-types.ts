/**
 * The row `/admin/reviews` queries and the table renders.
 *
 * `reviewedAt` stays a `Date`: the label shown publicly is derived from it, and
 * formatting happens in the component so the server-rendered HTML and the
 * hydrated one agree.
 */
export interface AdminReview {
  id: string;
  authorName: string;
  rating: number;
  text: string;
  reviewedAt: Date;
  photoPath: string | null;
  sortOrder: number;
  isPublished: boolean;
  updatedAt: Date;
}

/** What the dialog sends. `reviewedAt` travels as a whole UTC instant. */
export interface ReviewFormValues {
  authorName: string;
  rating: number;
  text: string;
  reviewedAt: string;
  photoPath: string;
  sortOrder: number;
  isPublished: boolean;
}
