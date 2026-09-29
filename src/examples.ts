// Three messy paragraphs, each chosen to show off a different skill:
// relative dates + abbreviations, slang + income conversion, a rambling voicemail transcript
// (whose own phone vs her daughter's, "around Thanksgiving", a spelled-out surname).
// All data is fictional (555-01xx phones, example.com email, a well-known invalid SSN).

export type ExampleId = 'maria' | 'dev' | 'dorothy'

export interface Example {
  id: ExampleId
  name: string
  blurb: string
  emoji: string
  text: string
}

export const EXAMPLES: Example[] = [
  {
    id: 'maria',
    name: 'Maria',
    blurb: 'the nurse',
    emoji: '🩺',
    text:
      "I'm Maria Lopez, born March 4th 91, moving from 12 Oak St SF to 440 Pine in Oakland on the 1st, " +
      "phone 415 555 0192, I work at Kaiser as a nurse. been renting my place 6 yrs, it's just me + my dog " +
      "Pepper, I make about 96k. SSN 123 45 6789 (don't tell anyone lol)",
  },
  {
    id: 'dev',
    name: 'Dev',
    blurb: 'chaotic texter',
    emoji: '📱',
    text:
      'yo its dev nair!! dob 11/22/98. currently at 88 marigold st apt 4, sf 94105, been here 2 yrs and the ' +
      'lease is up 😩 need a place by nov 15th lol. looking at 2100 Larkspur Ave #3B in berkeley, 12 mo lease ideally. ' +
      '2 ppl + my cat mochi 🐈 software guy @ loopwise, 3 yrs, full time, ~140k/yr. cell (628) 555-0147 or ' +
      'devn@example.com, text me pls. no smoking',
  },
  {
    id: 'dorothy',
    name: 'Grandma',
    blurb: 'voicemail',
    emoji: '☎️',
    text:
      "Hello dear, this is Dorothy Anne Whitfield, that's W-H-I-T-F-I-E-L-D. I was born July 5th, 1948. " +
      "I've lived at 1600 Maple Drive in Sacramento for 31 years, we owned the house, but I'm moving to be closer to " +
      'my daughter, at 22 Harbor View Road, unit B, in Santa Cruz, sometime around Thanksgiving. I\'m retired, I taught ' +
      "third grade. My number is 916-555-0133. My daughter Susan's number, in case of emergency, is 831-555-0178. " +
      'Oh, and Biscuit, my little dog, is coming too. Just the two of us!',
  },
]
