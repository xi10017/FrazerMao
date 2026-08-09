export function getAuthRedirectUrl(): string {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredSiteUrl) {
    return configuredSiteUrl;
  }

  if (typeof window === 'undefined') {
    return '/';
  }

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  return `${window.location.origin}${basePath}/`;
}
