/**
 * The shared atmosphere state. The master timeline *writes* these values as
 * the visitor scrolls; the canvas systems and CSS light layers *read* them
 * every frame. This is the seam that keeps animation choreography separate
 * from rendering.
 *
 * All values are 0–1 intensities unless noted.
 */
export const atmo = {
  ash: 0.32, // cold drifting motes
  embers: 0, // rising fire sparks
  fogAlpha: 0.1, // fog layer opacity
  fogWarm: 0, // 0 = steel blue fog, 1 = amber fog
  coldLight: 0.07, // pale backlight high in the frame
  fireLight: 0, // warm light from below
  flash: 0, // distant thunder (spiked briefly by the timeline)
  glow: 0, // central golden bloom that welcomes the title video
  vignette: 0.62, // edge darkening
  wind: -0.16, // horizontal drift, in viewport-widths/minute (sign = direction)
  heroMode: 0, // 0 = prologue, 1 = hero ambience (calmer, slower)
}
