"use client";

import { useRouter } from "next/navigation";
import { PhotoUploader } from "@/components/PhotoUploader";

export function AdminPhotoUploader({ helperId, hasPhoto }: { helperId: string; hasPhoto: boolean }) {
  const router = useRouter();
  return (
    <PhotoUploader
      uploadUrl={`/api/admin/helper/${helperId}/photo`}
      hasPhoto={hasPhoto}
      onUploaded={() => router.refresh()}
    />
  );
}
