import { useEffect, useMemo, useState } from "react";

function websiteIconUrl(website?: string) {
  if (!website?.trim()) return "";
  try {
    const href = /^https?:\/\//i.test(website) ? website : `https://${website}`;
    const url = new URL(href);
    return `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(url.origin)}&sz=128`;
  } catch {
    return "";
  }
}

export default function CompanyLogoMark({
  logoUrl,
  website,
  emoji,
  name,
  className = "h-full w-full object-contain p-1",
}: {
  logoUrl?: string;
  website?: string;
  emoji?: string;
  name: string;
  className?: string;
}) {
  const candidates = useMemo(
    () => [logoUrl?.trim() || "", websiteIconUrl(website)].filter(Boolean),
    [logoUrl, website],
  );
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => setCandidateIndex(0), [logoUrl, website]);

  const src = candidates[candidateIndex];
  if (src) {
    return (
      <img
        src={src}
        alt={`${name} logo`}
        className={className}
        onError={() => setCandidateIndex((index) => index + 1)}
      />
    );
  }

  return <>{emoji || "🏢"}</>;
}
