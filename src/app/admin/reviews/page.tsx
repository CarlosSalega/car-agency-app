import { redirect } from "next/navigation";

import { ReviewsTable } from "@/components/reviews";
import { requireAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * The panel's reviews section.
 *
 * ADMIN-only like `/admin/leads`: a testimonial is published on the business's
 * behalf and signed with a customer's name.
 *
 * The list is queried here, in the server component, the same way the other
 * sections do it — there is no GET route for the panel. Unpublished rows are
 * included on purpose: the whole workflow is "load it, read it, then publish it",
 * and a list that hides the draft makes the second step impossible.
 */
export default async function AdminReviewsPage() {
  const session = await requireAuthSession();

  if (session.user.role !== "ADMIN") {
    redirect("/admin");
  }

  const reviews = await prisma.review.findMany({
    orderBy: [{ sortOrder: "asc" }, { reviewedAt: "desc" }],
    select: {
      id: true,
      authorName: true,
      rating: true,
      text: true,
      reviewedAt: true,
      photoPath: true,
      sortOrder: true,
      isPublished: true,
      updatedAt: true,
    },
  });

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-6">
        <ReviewsTable reviews={reviews} />
      </div>
    </div>
  );
}
