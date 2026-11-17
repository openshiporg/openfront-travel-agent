// Place photos shipped with the storefront, by destination slug. Any other destination gets the open-road photo.
const PHOTOS = new Set(['alaska', 'costa-rica', 'greece', 'iceland', 'italy', 'japan', 'peru', 'portugal'])
export const photoFor = (slug: string) => `/storefront/${PHOTOS.has(slug) ? slug : 'place'}.webp`
