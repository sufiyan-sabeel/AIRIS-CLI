/**
 * Lazy-loaded Anime.js v4 helpers.
 * Import these instead of `animejs` directly to keep the bundle small.
 */
let animeCache: any = null;

export async function getAnime() {
  if (animeCache) return animeCache;
  try {
    const mod = await import("animejs");
    animeCache = mod;
    return mod;
  } catch {
    return null;
  }
}

/** Fade an element in using Anime.js v4 */
export async function fadeIn(
  target: string | Element | Element[],
  delay = 0,
  duration = 600
) {
  const anime = await getAnime();
  if (!anime) return;
  return anime.animate(target, {
    opacity: [0, 1],
    translateY: [12, 0],
    duration,
    delay,
    ease: "outExpo",
  });
}

/** Staggered reveal of elements */
export async function staggerReveal(
  target: string | Element | Element[],
  staggerDelay = 80
) {
  const anime = await getAnime();
  if (!anime) return;
  return anime.animate(target, {
    opacity: [0, 1],
    translateY: [20, 0],
    duration: 500,
    delay: anime.stagger(staggerDelay),
    ease: "outExpo",
  });
}

/** Counter animation */
export async function animateCounter(
  target: Element,
  from: number,
  to: number,
  duration = 1200
) {
  const anime = await getAnime();
  if (!anime) return;
  const obj = { val: from };
  return anime.animate(obj, {
    val: to,
    duration,
    ease: "outExpo",
    onUpdate: () => {
      target.textContent = Math.round(obj.val).toString();
    },
  });
}
