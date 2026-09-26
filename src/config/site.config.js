/**
 * Site configuration — the single place to edit copy, pacing and behavior.
 * No media files are referenced here: everything visual is discovered from
 * the /assets folders automatically (see src/core/assets.js).
 */
export const site = {
  title: 'Game of Thrones — A Cinematic Experience',

  brand: {
    // Used only when no logo file exists in assets/logo/
    wordmark: 'Game of Thrones',
  },

  nav: [
    { label: 'Prologue', target: '#top' },
    { label: 'The Realm', target: '#hero' },
    { label: 'The World', target: '#world' },
    { label: 'Jon Snow', target: '#jon' },
    { label: 'Daenerys', target: '#dany' },
    { label: 'Finale', target: '#ending' },
  ],

  prologue: {
    // Scroll length of the cinematic prologue, in viewport-heights.
    lengthVh: 640,
    lengthVhMobile: 520,
    lengthVhReduced: 220,
    captions: [
      'First, the ice',
      'Then, the fire',
    ],
    scrollCue: 'Scroll',
    skipLabel: 'Skip prologue',
  },

  hero: {
    kicker: 'The Seven Kingdoms await',
    heading: 'The Realm Remembers',
    subtitle: 'An interactive journey through ice and fire — every scroll turns a page of the saga.',
    // action 'portal' opens the cinematic gateway; anything else smooth-scrolls
    cta: { label: 'Enter the Realm', action: 'portal', target: '#world' },
  },

  world: {
    // Scroll length of the world journey, in viewport-heights.
    // Generous: the film is a 68-second voyage — give it room to breathe.
    lengthVh: 820,
    lengthVhMobile: 620,
    lengthVhReduced: 220,
    kicker: 'The Known World',
    captions: [
      'Seven kingdoms, one throne',
      'From the Wall to the Narrow Sea',
      'Winter never forgets',
    ],
  },

  jon: {
    // Scroll length of the chapter, in viewport-heights. The film is a
    // 77-second saga plus the memorial finale — give both room.
    lengthVh: 940,
    lengthVhMobile: 720,
    lengthVhReduced: 260,
    kicker: 'The North',
    // Story moments revealed as the film progresses. `at` is the chapter
    // progress where the moment begins; `side` places it on desktop.
    moments: [
      {
        at: 0.14,
        side: 'left',
        title: 'Raised Without a Crown',
        text: 'A boy raised in the shadows of Winterfell, carrying no title… only courage.',
      },
      {
        at: 0.26,
        side: 'right',
        title: 'The Bastard of Winterfell',
        text: 'Judged by birth. Respected by actions.',
      },
      {
        at: 0.38,
        side: 'left',
        title: 'Guardian of the Wall',
        text: 'Where the living stand against the endless night.',
      },
      {
        at: 0.5,
        side: 'right',
        title: 'Commander of the Night’s Watch',
        text: 'Honor above fear. Duty above life.',
      },
      {
        at: 0.63,
        side: 'left',
        title: 'The North Remembers',
        text: 'When hope fades… the North still stands.',
      },
    ],
    finale: {
      name: 'Jon Snow',
      subtitles: ['The White Wolf', 'King in the North', 'The Shield Against the Long Night'],
      quote: '“Some are born to rule. Others earn it.”',
    },
  },

  dany: {
    // Scroll length of the chapter, in viewport-heights.
    lengthVh: 920,
    lengthVhMobile: 700,
    lengthVhReduced: 260,
    kicker: 'Fire and Blood',
    moments: [
      {
        at: 0.15,
        side: 'left',
        title: 'Born in Exile',
        text: 'A princess without a kingdom… destined to reclaim one.',
      },
      {
        at: 0.27,
        side: 'right',
        title: 'Mother of Dragons',
        text: 'From fire came life. From ashes came destiny.',
      },
      {
        at: 0.39,
        side: 'left',
        title: 'Breaker of Chains',
        text: 'She shattered empires before she sought a throne.',
      },
      {
        at: 0.51,
        side: 'right',
        title: 'The Last Targaryen',
        text: 'Blood of the dragon. Fire made flesh.',
      },
    ],
    finale: {
      name: 'Daenerys Targaryen',
      subtitle: 'Queen of Ashes',
      quote: '“Fire does not ask permission. It simply consumes.”',
    },
  },

  ending: {
    title: 'Game of Thrones',
    returnLabel: 'Return to the Beginning',
    // seconds — the timed cinematic that plays once the visitor arrives
    timings: {
      absorb: 1.3, // let the world breathe before the title
      titleReveal: 2.4,
      titleHold: 1.6,
      fadeToBlack: 1.5,
      silence: 1.0,
      fire: 3.0,
      settle: 1.3,
      finalFade: 1.8,
    },
  },

  epilogue: {
    heightVh: 92,
    heading: 'Game of Thrones',
    line: 'The saga endures. The realm remembers.',
    copyright: '© 2026 · A fan-made cinematic experience — not affiliated with HBO',
    // replace the hrefs with your profiles; icons render for every entry
    social: [
      { name: 'instagram', href: '#' },
      { name: 'x', href: '#' },
      { name: 'youtube', href: '#' },
    ],
    // optional: an email address; leave empty to hide the contact link
    contact: '',
  },

  portal: {
    // seconds for each act of the crossing
    coverDuration: 1.25,
    revealDuration: 1.35,
    // where the traveller lands, as progress through the world section
    arrivalProgress: 0.055,
  },

  // One pacing law for every film chapter: how many viewport-heights of
  // scroll one second of footage deserves. Chapter runways are computed
  // from their film's real duration, so every chapter scrubs at the same
  // felt speed — no section ever faster or slower than its neighbours.
  pacing: {
    vhPerFilmSecond: 9.2,
    mobileFactor: 0.78,
    maxVh: 1150,
  },

  // Fine-grained motion pacing (master timeline positions, 0–1 across the
  // prologue). Tuned to the arc of the title video: darkness -> cold -> fire
  // -> golden title -> black -> hero.
  scenes: {
    darkness: { start: 0.0, end: 0.12 },
    suspense: { start: 0.1, end: 0.3 },
    fire: { start: 0.3, end: 0.46 },
    reveal: { start: 0.44, end: 0.87 },
    handoff: { start: 0.87, end: 1.0 },
  },
}
