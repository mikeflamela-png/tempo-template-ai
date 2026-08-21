# Template Genius

Build a working MVP web application called Template Lab.

PRODUCT VISION

Template Lab is an AI-powered generator for short-form social video editing templates.

Think of the experience of using a CapCut template, except instead of browsing a finite library of templates, the user can generate unlimited new templates from a prompt.

The core experience is:

Describe the type of social video you want → Generate → instantly see several creative animated templates → choose one → replace placeholder media with your own clips/images → preview → export.

The AI is NOT responsible for analyzing the user's footage.

The AI is NOT responsible for deciding which uploaded clip belongs where.

The AI is NOT generating synthetic video.

The AI is designing the EDIT TEMPLATE.

The user's media simply replaces predetermined placeholder slots.

This distinction is fundamental to the product.

PRIMARY USER FLOW

The home screen should be extremely simple and premium.

Large heading:

What do you want to make?

Large prompt field with example:

Create a punchy 10-second footwear ad for Instagram Reels. Premium but energetic. Fast opening, interesting transitions, minimal typography, strong product ending.

Below the prompt provide optional controls:

Platform

Instagram / Reels

TikTok

Meta Ads

YouTube Shorts

Duration

6 sec

8 sec

10 sec

12 sec

15 sec

20 sec

30 sec

Format

9:16

1:1

4:5

16:9

Energy

Minimal

Cinematic

Energetic

Aggressive

Playful

Template Complexity

Simple

Creative

Experimental

Then a prominent:

GENERATE TEMPLATES

button.

GENERATION EXPERIENCE

When Generate is clicked, create 4 meaningfully different template concepts.

Do NOT generate four minor variations of the same timeline.

Each template should have a name such as:

FLASH STACK

KINETIC PRODUCT

RHYTHM CUT

SPLIT REVEAL

Each result should appear as a visual 9:16 video card.

The user should be able to press Play and immediately understand what the finished editing style feels like.

For the MVP, use attractive generic placeholder imagery/video or animated placeholder frames so the templates are visually understandable BEFORE the user uploads any media.

Each card should display:

Template name

Duration

Number of media slots

Number of text moments

Play preview

Use Template

Regenerate Similar

The previews should actually animate.

Do NOT represent templates as written shot lists.

Do NOT make the primary output JSON.

Do NOT make the user read editing instructions.

The primary output is a visual moving template.

WHAT A TEMPLATE IS

Internally, every generated template should be represented as structured data.

A template contains:

total duration

aspect ratio

media placeholders

exact start/end time of every placeholder

layout of every placeholder

crop behavior

scale

position

rotation

opacity

animation/keyframes

transitions

overlays

masks

text elements

typography

text animations

background elements

timing markers

optional music/beat markers

CTA/end-card behavior

Media placeholders are EMPTY SLOTS.

Example:

MEDIA_SLOT_01
start: 0
duration: 0.35
purpose: hook
animation: punch_in
transition_out: hard_cut

MEDIA_SLOT_02
start: 0.35
duration: 0.30
purpose: product_detail
animation: slide_left
transition_out: flash

The user later chooses which media goes into each slot.

CRITICAL CREATIVE REQUIREMENT

The generated templates must feel like modern short-form social editing, NOT generic slideshow templates.

Templates should intelligently combine a controlled library of reusable creative primitives.

Create a reusable internal component library containing concepts such as:

CUT PATTERNS

rapid burst

rhythmic hard cuts

slow-fast-slow

micro-cut sequence

build-and-release

alternating short/long shots

TRANSITIONS

hard cut

punch zoom

snap zoom

directional slide

whip

blur transition

flash transition

mask reveal

object-style wipe

scale transition

match-cut style transition

LAYOUTS

full screen

vertical split

horizontal split

2-up grid

3-up grid

4-up grid

picture-in-picture

stacked frames

floating frame

expanding frame

full-screen reveal

MOTION

subtle push-in

aggressive punch-in

pull-out

pan

drift

snap movement

scale bounce

parallax-style motion

freeze-frame moment

TYPOGRAPHY

oversized hook

kinetic words

staggered word reveal

feature callout

minimal caption

centered statement

edge-aligned typography

masked text reveal

CTA lockup

EDIT STRUCTURES

hook → product → lifestyle → CTA

hook → benefit → proof → CTA

rapid montage → breathing moment → product reveal

lifestyle → details → product hero

problem → solution → product

text hook → visual proof → CTA

build → burst → hero

The AI should COMPOSE these known primitives.

Do not allow the AI to invent unsupported effects.

This keeps generated templates reliable while allowing enormous creative variation.

TEMPLATE EDITOR / MEDIA REPLACEMENT

When the user clicks Use Template, open a simple template customization screen.

This should NOT resemble Premiere Pro.

This should NOT be a complicated editing timeline.

The goal is the simplicity of replacing media in a CapCut template.

Left side:

Your Media

Allow drag/drop upload of video clips and images.

Center:

Large video preview/player.

Right side:

Replace Media

Display visually:

SHOT 01 — HOOK
[ Drop media ]

SHOT 02 — DETAIL
[ Drop media ]

SHOT 03 — LIFESTYLE
[ Drop media ]

SHOT 04 — PRODUCT
[ Drop media ]

etc.

Each slot should show its duration.

Example:

SHOT 01 — 0.4 sec

Dragging media into that slot replaces the placeholder while PRESERVING:

slot duration

animation

crop behavior

transition

position

effects

timing

The user is choosing the footage.

The software is NOT choosing footage.

CLIP ADJUSTMENT

After placing media into a slot, allow the user to click it and make only basic adjustments:

choose source in/out point

reposition crop

zoom

mute/unmute

Do NOT build a full editing interface.

TEXT

If the template contains text placeholders, show simple editable fields:

HOOK
[________________]

BENEFIT
[________________]

CTA
[________________]

Updating text should immediately update the preview.

PREVIEW

The preview is extremely important.

The user needs to be able to watch the template before adding footage.

After media replacement, the preview should update with their media while preserving the template's editing structure.

The entire product should feel:

Generate → Preview → Replace → Export

not:

Create Project → Edit Timeline → Configure Effects → Render

VIDEO ARCHITECTURE

Use Remotion as the programmable video composition layer.

Lovable should build the application/UI around it.

Use Remotion's Player for interactive browser previews.

Templates should be parameterized compositions.

The AI should NOT generate arbitrary React/Remotion source code every time.

Instead:

AI generates a validated TemplateSpec JSON object.

A stable rendering system interprets TemplateSpec using our approved component/effect library.

Conceptually:

USER PROMPT

↓

AI TEMPLATE DIRECTOR

↓

VALIDATED TEMPLATE SPECIFICATION

↓

TEMPLATE COMPOSITION ENGINE

↓

REMOTION COMPONENTS

↓

INTERACTIVE PREVIEW

↓

USER REPLACES MEDIA

↓

RENDER / EXPORT

This separation is extremely important.

TEMPLATE SPECIFICATION

Create a strongly typed TemplateSpec schema.

Example structure:

interface TemplateSpec {
  id: string;
  name: string;
  duration: number;
  fps: number;
  width: number;
  height: number;

  mediaSlots: MediaSlot[];
  textSlots: TextSlot[];
  overlays: Overlay[];
  beatMarkers: number[];

  creativeProfile: {
    energy: string;
    pacing: string;
    typography: string;
    transitionStyle: string;
  };
}


Each MediaSlot should include:

interface MediaSlot {
  id: string;
  start: number;
  duration: number;
  purpose:
    | "hook"
    | "product"
    | "detail"
    | "lifestyle"
    | "proof"
    | "hero";

  layout: string;
  animationIn?: string;
  animationDuring?: string;
  animationOut?: string;
  transitionOut?: string;

  transform?: {
    startScale?: number;
    endScale?: number;
    x?: number;
    y?: number;
    rotation?: number;
  };
}


Validate generated templates before showing them.

Reject/regenerate invalid template specifications.

Templates must never:

exceed total duration

contain overlapping primary media unless intentionally using a multi-frame layout

reference unsupported effects

create impossible timing

create blank timeline gaps unless intentional

TEMPLATE VARIATION ENGINE

This is important.

Generating another template should not merely randomize clip durations.

Templates should vary across multiple creative dimensions:

pacing

number of clips

opening structure

transition grammar

layout changes

typography

visual rhythm

density

motion

ending structure

Create meaningful creative families.

For example:

Rapid Product
Fast cuts, punch-ins, detail shots.

Editorial
Interesting layouts, whitespace, typography.

Cinematic
Longer shots, subtle movement, restrained text.

Kinetic
Motion, rapid layout changes, energetic typography.

Performance Ad
Hook, benefits, product proof, CTA.

Lifestyle
Human/environment emphasis with product integrated naturally.

REGENERATE SIMILAR

Every generated template should have:

Regenerate Similar

This should preserve the broad creative DNA while changing:

timing

clip pattern

transition choices

layout moments

text timing

ending

Example:

User likes KINETIC PRODUCT.

Click:

Generate 5 Similar

The system creates five distinct descendants of that concept.

SAVE TEMPLATE

Allow users to save templates into a library.

Library categories:

All

Saved

Footwear

Fashion

Outdoor

Beverage

Beauty

Product

Lifestyle

Performance Ads

For now these can be simple tags.

MVP EXPORT

Implement a working export path using Remotion's rendering system.

User should be able to export a finished MP4 after filling the media slots.

For the MVP, prioritize reliable rendering over advanced export options.

Default:

1080 × 1920
H.264 MP4

DESIGN

The UI should feel like a modern creative tool.

Think:

CapCut simplicity + premium creative-software aesthetic.

Use:

large visual previews

generous whitespace

restrained UI

strong typography

minimal chrome

large template thumbnails

subtle motion

dark creative workspace for the template editor

Do not make it look like an enterprise dashboard.

Do not fill the screen with analytics cards.

Do not make it look like a generic SaaS admin panel.

The VIDEO TEMPLATE should always be the visual focus.

MVP PRIORITIES

Build in this order:

PRIORITY 1

A working visual template system with at least 5 genuinely different hand-authored TemplateSpec examples.

They must actually animate in the browser.

Do this BEFORE implementing AI generation.

PRIORITY 2

Template selection → media replacement.

User can upload media and assign it manually to slots.

PRIORITY 3

Live preview with replacement media.

PRIORITY 4

Working MP4 export.

PRIORITY 5

AI prompt → TemplateSpec generation.

PRIORITY 6

Generate multiple concepts and Regenerate Similar.

Do not sacrifice Priorities 1–4 to make the AI portion appear functional.

The underlying template system needs to actually work.

IMPORTANT PRODUCT RULES

DO NOT analyze uploaded footage.

DO NOT automatically choose shots.

DO NOT automatically decide where media belongs.

DO NOT generate synthetic video.

DO NOT build a traditional nonlinear video editor.

DO NOT make users manipulate tracks.

DO NOT make the timeline the primary interface.

DO NOT return written editing instructions as the product.

DO NOT fake video previews with static cards.

DO NOT make "Generate" simply choose from a few hardcoded templates.

The end state must support genuinely new template structures.

The user's job should eventually be only:

1. Describe video

2. Generate templates

3. Pick template

4. Drop media into slots

5. Change text

6. Export

FIRST BUILD

For this first implementation, focus only on proving the template experience.

Create five polished, substantially different templates:

Rapid Product

Kinetic Type

Editorial Split

Lifestyle Build

Product Reveal

Use attractive placeholder media so I can press Play on each one and judge whether this concept feels comparable to using a good modern social video template.

Do not build authentication, billing, teams, analytics, onboarding flows, subscriptions, or other SaaS infrastructure yet.

I care about one thing:

Can this system produce a visually exciting template, let me replace the media, and preserve the edit?

Build that first.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://tempo-template-ai.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5800bb0d-db8d-4b9a-aec6-77dadd7542d7).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
