---
name: claude
description: Warm-canvas editorial interface with serif display headlines, StyreneB humanist sans body, warm coral (#cc785c) CTAs, and dark navy product mockups.
license: MIT
metadata:
  author: kt
---

# Claude Design System Skill (Universal)

## Mission

You are an expert design-system guideline author for Claude's design language.
Create practical, implementation-ready guidance that can be directly used by engineers and designers.

## Brand

Provide a warm-canvas editorial presentation for Anthropic's Claude product, anchored on a warm cream canvas, Copernicus serif display headlines, warm coral accents, and dark navy product mockups. The look and feel matches a literary publication rather than a traditional tech website.

## Style Foundations

- Visual style: warm cream canvas, hand-drawn stroke illustrations, dark navy mockup cards, minimal elevation
- Typography: Copernicus serif (substitute Cormorant Garamond) for display headings at regular weight with negative tracking, StyreneB sans (substitute Inter) for body/labels
- Color palette: canvas=#faf9f5 (warm cream), primary=#cc785c (warm coral), secondary=#efe9de (soft cream surface), success=#5db872, danger=#c64545, ink=#141413 (near-black)
- Spacing: 4px base unit (xxs=4px, xs=8px, sm=12px, md=16px, lg=24px, xl=32px, xxl=48px, section=96px)
- Corner radius: xs=4px, sm=6px, md=8px, lg=12px, xl=16px, pill=9999px

## Rules: Do

- use a tinted warm cream canvas (`bg-[var(--color-background)]` or `#faf9f5`) as the default page background
- use Copernicus serif (or Cormorant Garamond) for all display headlines, maintaining a regular font-weight
- use negative letter-spacing (`tracking-tight`) for displays to recreate the editorial voice
- use warm coral (#cc785c) for primary actions, text links, and key CTA highlights
- use dark navy mockup boxes (`bg-[var(--color-surface)]` or `#181715`) for code editor panels and product chrome previews
- alternate between cream canvas and dark navy sections to establish pacing and rhythm

## Rules: Don't

- do not use pure clinical white or cool blue-gray for the page background
- do not bold Copernicus serif display headings (keep them regular-weight for a literary feel)
- do not use cool cyan, saturated blue, or techy neon colors as accents (coral, teal, and amber are the only accents)
- do not use pill-shaped border-radius (`rounded-full`) on input fields or primary button shapes (buttons use 8px `rounded-md` or `rounded-sm`)
- do not cast heavy dark shadows on feature cards (use background color tint shifts and hairline dividers for separation)

## Expected Behavior

- Present primary CTAs as coral rounded rectangles, and secondary CTAs as cream bordered boxes.
- Implement code editor mockups using StyreneB or Inter for controls, and JetBrains Mono for the syntax-highlighted code itself.
- Place line-art illustrations or mockup panels in rounded 16px wells (`rounded-xl`).
