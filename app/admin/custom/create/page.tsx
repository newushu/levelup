import { redirect } from "next/navigation";

type CreateRedirectPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function CreateRedirectPage({ searchParams }: CreateRedirectPageProps) {
  const params = new URLSearchParams();
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((entry) => {
          if (entry) params.append(key, entry);
        });
      } else if (value) {
        params.set(key, value);
      }
    });
  }

  const query = params.toString();
  redirect(`/admin/custom/email-builder${query ? `?${query}` : ""}`);
}
