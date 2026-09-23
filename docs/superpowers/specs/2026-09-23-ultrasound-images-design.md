# Ultrasound Images in the Simulator — Design

## 1. Overview

Add bedside/point-of-care ultrasound images to the delivery room simulator. Each scenario can carry a small gallery of ultrasound images. A card can have a "default" image attached to it; the instructor can also push any image from the scenario's gallery live, independent of the active card. One scenario (Instrumental Delivery) gets a special interactive image: the trainee measures the Angle of Progression (AOP) by drawing a line on the image against a pre-calibrated reference line.

This builds on the existing card/live-override architecture (see `SIMULATOR-SPEC-FINAL.md`, `lib/simulatorTypes.ts`, `lib/simulatorScenarios.ts`, `components/tools/simulator/*`).

## 2. Scope

**In scope:**
- New `ultrasound_images` gallery per scenario, referenced by id from cards.
- A "US" button visible on instructor, midwife-supervisor, and trainee/display views, reflecting whether an image is currently active.
- A modal image viewer.
- An instructor control to push any scenario image live (new Pusher event `ultrasound-push`), and inclusion of the default image id in `card-advance` payloads.
- An interactive AOP-measurement variant of the viewer for Instrumental Delivery, Card 1: a pre-set pubic-symphysis reference line, trainee draws the fetal-skull-contour line, angle computed and displayed live. No scoring/comparison.
- Scenarios getting ultrasound content: PPH, Uterine Rupture, Preterm Labor 26w, Fetal Bradycardia (plain images), Instrumental Delivery (AOP interactive).

**Out of scope (for this iteration):**
- Sourcing/selecting the actual image files — the user supplies these separately. This design scaffolds the feature with placeholder paths; wiring real images in is a follow-up step once files exist.
- Scoring/grading the AOP measurement.
- Shoulder Dystocia, Eclampsia, and AFE scenarios (assessed as weak/moderate fit; not included now).
- Any DB-backed editing of ultrasound images via the admin scenario editor (images are seeded via `lib/simulatorScenarios.ts`, same as other scenario content today).

## 3. Data Model (`lib/simulatorTypes.ts`)

```ts
export interface UltrasoundReferenceLine {
  x1: number; y1: number; x2: number; y2: number; // pixel coords in the source image
}

export interface UltrasoundImage {
  id: string;                 // stable id, unique within the scenario, e.g. 'pph-retained-products'
  src: string;                // path under /public, e.g. '/simulator/ultrasound/pph/retained-products.jpg'
  label: string;               // short Hebrew label shown on the instructor's thumbnail/push button
  type: 'image' | 'aop';       // 'aop' enables the interactive measurement viewer
  reference_line?: UltrasoundReferenceLine; // required when type === 'aop'
}
```

Additions to existing types:
- `SimScenario.ultrasound_images?: UltrasoundImage[]`
- `CardStructuredData.ultrasound_image_id?: string | null` — the id of the image (from the scenario's gallery) that becomes active by default when this card is shown. `null`/omitted means no default image (button goes dark on card advance unless overridden).

## 4. Sync (Pusher)

This section is written against the actual current sync architecture in `components/tools/simulator/PusherSync.ts` and `app/tools/simulator/page.tsx` (re-verified after pulling 8 upstream commits that reworked labs push, theming, and CTG realism — see §8).

- `SyncEvent` (in `PusherSync.ts`) gains a member: `{ type: 'ultrasound-push'; imageId: string | null }`, added to the `ALL_EVENT_TYPES` array alongside the existing `labs-push`, `live-override`, etc.
- The instructor page (`app/tools/simulator/page.tsx`) keeps CTG/vitals as both React state and a ref (`ctgParamsRef`/`vitalsRef`) so the latest values are available synchronously when building a `structuredData` snapshot (see `handleSpeedChange` around line 890: `sd = { ...baseSD, ctg: ctgParamsRef.current, vitals: vitalsRef.current }`). The active ultrasound image id follows the same pattern: `ultrasoundImageId` state + `ultrasoundImageIdRef`, included in every `sd` build as `sd.ultrasound_image_id = ultrasoundImageIdRef.current`.
- Card advance: when building `sd` for a `card-advance` publish, set `ultrasoundImageIdRef.current = card.structured_data?.ultrasound_image_id ?? null` — an **unconditional** overwrite (unlike `ctg`/`vitals`, which persist across cards by design). This is the mechanism that clears an instructor's earlier push when the card changes.
- Instructor push: a new handler (mirroring `handleSpeedChange`) sets `ultrasoundImageIdRef.current = imageId`, publishes `{ type: 'ultrasound-push', imageId }`, and re-sends a `state-snapshot` the same way other instructor actions do (so it's immediately reflected in `PUT /api/sim-state/[code]` for the polling fallback, not just the Pusher push).
- Participant page (`app/tools/simulator/participant/[code]/page.tsx`): add a handler for `event.type === 'ultrasound-push'` that unconditionally sets local state (`setActiveUltrasoundImageId(event.imageId)`), and extend both `card-advance` and `state-snapshot` handling (there are two near-identical blocks, ~line 309 and ~line 361) to unconditionally read `d?.ultrasound_image_id ?? null` from `structuredData` — again, no `if (d?.x)` guard, since absence must mean "clear."
- `snapshotExtras()` (page.tsx, ~line 873) does **not** need a new field for this — unlike `pushedLabs` (an accumulating array replayed in full for late joiners), the active image id is single current-value state that already rides inside `structuredData` like `ctg`/`vitals`, so it's covered by the existing snapshot mechanism.
- No DB persistence needed — transient session state, same as CTG/vitals.

## 5. UI

### 5.1 US button
- Small button (e.g. "🩻 US") placed in the patient banner row, visible on instructor, midwife-supervisor, and trainee/display tablets.
- Lit/active state: active ultrasound image id is non-null.
- Dark/inactive state: active ultrasound image id is null. Button is disabled (non-clickable) in this state.
- Click opens `UltrasoundViewer` modal showing the currently active image.

### 5.2 `UltrasoundViewer` (new component, `components/tools/simulator/UltrasoundViewer.tsx`)
- Props: the active `UltrasoundImage`, close handler.
- `type: 'image'` → renders the image full-size in a modal, with the `label` as a caption.
- `type: 'aop'` → renders the image on a `<canvas>` (or SVG overlay), draws the pre-set `reference_line`, and lets the trainee click two points (or click-drag) to draw a second line. Computes the angle between the two lines (standard 2D vector angle) and displays it live (e.g. "AOP: 137°"), updating as the trainee redraws. A "reset" control clears the drawn line. No comparison to a correct value — purely a measurement practice tool.

### 5.3 Instructor push panel
- New component `UltrasoundPushPanel.tsx`, following the `LabsPushPanel.tsx` pattern exactly: a `'use client'` modal dynamic-imported in `page.tsx` (`{ ssr: false }`), styled via `useSimTheme()`, `isOpen`/`onClose` props. Shows a thumbnail grid of the current scenario's `ultrasound_images` (only rendered if the scenario has any) plus a "clear" action. Tapping a thumbnail (or clear) calls an `onPush(imageId: string | null)` prop, which the parent wires to the publish logic described in §4.
- `InstructorControls.tsx` gets a new icon button (mirroring the existing `onOpenLabsPush` prop/button around line 187-190), e.g. `onOpenUltrasoundPush`, title "הצג/שלח הדמיית אולטרסאונד", rendered only when the active scenario has `ultrasound_images`.
- The same panel (or the plain `UltrasoundViewer`) also lets the instructor view the currently active image, not just push a new one — consistent with them being able to see everything trainees see.

## 6. Rollout Plan

1. Build the plumbing (types, `ultrasound-push` sync event, ref/state tracking in `page.tsx`, unconditional-overwrite handling in the participant page, US button, `UltrasoundViewer` incl. AOP mode, `UltrasoundPushPanel`) using placeholder image paths and one placeholder `aop` entry with a rough reference line, so the feature is fully functional and testable end-to-end without final images.
2. User supplies real image files per scenario (PPH, Uterine Rupture, Preterm Labor 26w, Fetal Bradycardia, and the Instrumental Delivery AOP still).
3. For each image: drop the file under `public/simulator/ultrasound/<scenario-slug>/`, add its `UltrasoundImage` entry to the scenario in `lib/simulatorScenarios.ts`, and set `ultrasound_image_id` on the relevant card(s). Note: scenario ids are positional (array index + 1) per `SEEDED_SCENARIOS`, and `id=4` (Eclampsia/severe-preeclampsia) currently has a DB override row that takes precedence over the seed file for that scenario only — irrelevant here since none of the target scenarios are id 4, but worth re-checking with a DB query before editing any scenario this feature touches, in case the admin panel has been used to edit them since.
4. For the AOP image specifically: user identifies (or confirms by eye, in-app during a quick calibration pass) the two endpoints of the pubic symphysis line in image-pixel coordinates; recorded as `reference_line`.

## 7. Testing

- Manual verification in the browser (per project convention — no existing simulator UI test suite covers this area): start a session on the seeded scenarios above, confirm button lights up/dims correctly across card advances and instructor pushes, confirm state-snapshot replay works for a late-joining tablet, confirm the AOP canvas draws and computes an angle correctly for a few test lines (e.g. a known 90°/180° case) using the placeholder image.

## 8. Notes on this revision

This design was originally drafted, and approved by the user, against `lib/simulatorScenarios.ts` / `lib/simulatorTypes.ts` / `components/tools/simulator/*` as they stood before pulling 8 upstream commits (labs editor + live labs push, light/dark theme system, CTG waveform realism fixes, simulation time-speed control, mobile setup redesign, Eclampsia scenario rework + 8 new scenarios). After pulling, §4 and §5.3 were rewritten to match the current architecture (in particular, the `labs-push`/`PushedLabRow`/`LabsPushPanel` precedent, which didn't exist when the design was first approved, turned out to be the closest existing analog and is now the model this design follows). The overall approach — gallery of images per scenario, default-per-card + instructor push, interactive AOP measurement — is unchanged from what the user approved; only the sync/component wiring details were corrected.
