export type DocumentViewerKind = 'google-drive' | 'word' | 'pdf';

/**
 * FAMAT often catalogs Word files with a fake ".doc.pdf" / ".docx.pdf" suffix.
 * The hosted file is actually .doc / .docx.
 */
export function normalizeDocumentUrl(url: string): string {
  if (/\.docx?\.pdf$/i.test(url)) {
    return url.replace(/\.pdf$/i, '');
  }
  return url;
}

/** URL opened in a new tab — uses web viewers when a raw file would download. */
export function getDocumentOpenUrl(url: string): string {
  const normalized = normalizeDocumentUrl(url);
  const kind = getDocumentViewerKind(url);

  if (kind === 'google-drive') {
    return normalized.replace(/\/preview(\?.*)?$/i, '/view$1');
  }

  if (kind === 'word') {
    return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(normalized)}`;
  }

  return normalized;
}

export function getDocumentViewerKind(url: string): DocumentViewerKind {
  const normalized = normalizeDocumentUrl(url);

  if (
    normalized.includes('drive.google.com') ||
    normalized.includes('docs.google.com')
  ) {
    return 'google-drive';
  }

  if (/\.docx?$/i.test(normalized)) {
    return 'word';
  }

  return 'pdf';
}
