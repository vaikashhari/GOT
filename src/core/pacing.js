/**
 * The single pacing law. Every scrubbed chapter computes its scroll runway
 * from its film's actual duration, so a second of footage always costs the
 * same scroll distance — across the world journey, Jon, Daenerys, and any
 * chapter yet to come. Swap a video and the runway retunes itself.
 */
import { site } from '../config/site.config.js'
import { quality } from './quality.js'

/**
 * @param meta          pipeline metadata for the chapter's film ({duration})
 * @param scrubFraction fraction of the chapter's runway the scrub occupies
 * @param fallbackVh    configured length used when no film/meta exists
 */
export function chapterRunwayVh (meta, scrubFraction, fallbackVh) {
  const duration = meta?.duration
  if (!duration) return fallbackVh
  const mobile = quality.tier === 'mobile' || quality.tier === 'low'
  const pace = site.pacing.vhPerFilmSecond * (mobile ? site.pacing.mobileFactor : 1)
  return Math.min(site.pacing.maxVh, Math.round((duration * pace) / scrubFraction))
}
