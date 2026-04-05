export function brpAssetUrlFromReference(referenceId) {
  if (referenceId == null || referenceId === '') return null;
  const enc = encodeURIComponent(String(referenceId));
  return `https://boulders.brpsystems.com/apiserver/api/assets/${enc}`;
}

export function resolveProductAssetImageUrl(product, hostname) {
  if (!product || typeof product !== 'object') return null;
  const assets = product.assets;
  if (!Array.isArray(assets) || assets.length === 0) return null;
  const mainAsset =
    assets.find((a) => a && (a.type === 'MAIN' || a.type === 'CENTERED')) || assets[0];
  if (!mainAsset) return null;
  let url = mainAsset.contentUrl || mainAsset.url || null;
  if (url && /^https?:\/\//i.test(url)) return url;
  if (url && url.startsWith('/')) return url;
  const ref = mainAsset.reference;
  if (!ref) return null;
  const host = hostname || '';
  const isDev = host === 'localhost' || host === '127.0.0.1';
  const isPages =
    host.includes('pages.dev') ||
    host.includes('join.boulders.dk') ||
    host === 'boulders.dk';
  if (isPages) return `/api-proxy?path=/api/assets/${encodeURIComponent(ref)}`;
  if (isDev) {
    return brpAssetUrlFromReference(ref) || `/api/assets/${encodeURIComponent(ref)}`;
  }
  return brpAssetUrlFromReference(ref) || `https://api-join.boulders.dk/api/assets/${encodeURIComponent(ref)}`;
}

export function resolveGroupActivityClassImageUrl(source, hostname) {
  if (!source || typeof source !== 'object') return null;
  if (typeof source.__resolvedImageUrl === 'string' && source.__resolvedImageUrl.trim()) {
    return source.__resolvedImageUrl.trim();
  }
  const fromProduct = (o) => {
    if (!o || typeof o !== 'object') return null;
    const p =
      o.groupActivityProduct ||
      o.eventProduct ||
      o.product ||
      o.groupActivity?.product ||
      o.event?.eventProduct;
    return resolveProductAssetImageUrl(p, hostname);
  };
  let url = fromProduct(source);
  if (url) return url;
  url = fromProduct(source.groupActivity);
  if (url) return url;
  url = fromProduct(source.event);
  if (url) return url;
  if (Array.isArray(source.assets) && source.assets.length) {
    return resolveProductAssetImageUrl({ assets: source.assets }, hostname);
  }
  return null;
}

export function extractGroupActivityProductId(source) {
  if (!source || typeof source !== 'object') return null;
  const ga = source.groupActivity;
  const p =
    source.groupActivityProduct ||
    source.eventProduct ||
    source.groupactivityProduct ||
    ga?.groupActivityProduct ||
    ga?.product ||
    ga?.eventProduct ||
    source.event?.eventProduct;
  const raw =
    p?.id ??
    source.groupActivityProductId ??
    ga?.groupActivityProduct?.id ??
    ga?.groupActivityProductId ??
    ga?.product?.id ??
    ga?.productId ??
    source.eventProductId ??
    source.event?.eventProduct?.id;
  const n = raw != null ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function classCardBusinessUnitId(source, customerFallback) {
  if (!source || typeof source !== 'object') return null;
  const raw =
    source.businessUnit?.id ??
    source.businessUnitId ??
    source.groupActivity?.businessUnit?.id ??
    source.__buId ??
    customerFallback?.businessUnit?.id;
  const n = raw != null ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}
