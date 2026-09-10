import { redirect } from "next/navigation";

export default async function DiningDetailRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/food/${id}`);
}
