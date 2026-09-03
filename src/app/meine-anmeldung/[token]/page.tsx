import { EditRegistration } from "@/components/EditRegistration";

export default async function MeineAnmeldungPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <EditRegistration token={token} />
    </main>
  );
}
