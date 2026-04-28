---
name: DotMan
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#bdc9c6'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#879391'
  outline-variant: '#3d4947'
  surface-tint: '#72d7cb'
  primary: '#b5fff4'
  on-primary: '#003732'
  primary-container: '#81e6d9'
  on-primary-container: '#00675f'
  inverse-primary: '#006a62'
  secondary: '#bcc7de'
  on-secondary: '#263143'
  secondary-container: '#3e495d'
  on-secondary-container: '#aeb9d0'
  tertiary: '#e4f3ff'
  on-tertiary: '#00354a'
  tertiary-container: '#a3dcff'
  on-tertiary-container: '#006386'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#8ff4e7'
  primary-fixed-dim: '#72d7cb'
  on-primary-fixed: '#00201d'
  on-primary-fixed-variant: '#005049'
  secondary-fixed: '#d8e3fb'
  secondary-fixed-dim: '#bcc7de'
  on-secondary-fixed: '#111c2d'
  on-secondary-fixed-variant: '#3c475a'
  tertiary-fixed: '#c4e7ff'
  tertiary-fixed-dim: '#7bd0ff'
  on-tertiary-fixed: '#001e2c'
  on-tertiary-fixed-variant: '#004c69'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  code-md:
    fontFamily: Space Grotesk
    fontSize: 13px
    fontWeight: '500'
    lineHeight: '1.6'
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Space Grotesk
    fontSize: 11px
    fontWeight: '700'
    lineHeight: '1'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin: 24px
  density: compact
---

## Brand & Style

This design system is engineered for precision, evoking the cold, focused atmosphere of a high-latitude research station or a cutting-edge terminal interface. The brand personality is utilitarian, technical, and unapologetically efficient, targeting power users who value information density and system transparency.

The visual style is a hybrid of **Brutalism** and **Glassmorphism**. It adopts the raw, structural integrity and high-contrast borders of Brutalism while tempering the harshness with the atmospheric depth and polished translucent layers characteristic of the "Iceberg" aesthetic. The result is a UI that feels like a physical instrument—solid, responsive, and deep.

## Colors

The palette is anchored in a deep, nocturnal foundation. The primary background uses a saturated navy-black to provide maximum contrast for the frosty accent colors. 

- **Primary (Icy Cyan):** Reserved for high-priority actions, focus states, and critical system feedback.
- **Secondary (Steel Blue):** Used for structural elements, inactive tabs, and secondary buttons.
- **Tertiary (Glacial Blue):** Applied to data visualizations and informational highlights.
- **Neutral:** A range of desaturated blues and greys used for borders, subtle backgrounds, and de-emphasized text.

Text should primarily be rendered in a crisp, high-value white or extremely light cyan to ensure legibility against the dark void of the background.

## Typography

The typographic strategy relies on a dual-font system to distinguish between navigational UI and technical data. **Inter** provides a neutral, highly readable foundation for menus, body copy, and headlines. Its clarity ensures that even at high densities, the interface remains navigable.

To achieve the "terminal meets GUI" aesthetic, **Space Grotesk** (or a system monospace like JetBrains Mono) is used for all data-driven elements, status indicators, and input fields. This font should be treated with generous letter spacing in label formats to mimic the look of hardware-engraved serial numbers or command-line outputs.

## Layout & Spacing

The layout philosophy favors high-density information architecture over whitespace. This design system utilizes a **12-column fluid grid** with tight 16px gutters to maximize the "dashboard" feel. 

Spacing follows a strict 4px base unit. Internal padding within components should be kept to a minimum (compact) to allow for more data points to be visible simultaneously. Layouts should feel modular, with clear vertical and horizontal lines of sight that reinforce the structural, brutalist nature of the system.

## Elevation & Depth

Depth is not communicated through traditional drop shadows but through **tonal stacking** and **glassmorphism**. 

1.  **Planes:** Surfaces are layered using slightly different shades of navy. Higher-level elements (like modals or floating panels) should use a backdrop blur (12px–20px) with a semi-transparent background color.
2.  **Borders:** The primary method of separation is a 1px high-contrast border. Use a low-opacity white or cyan for these borders to create a "glowing wireframe" effect.
3.  **Active Depth:** When an element is focused or active, it should not rise via shadow but rather "illuminate" via a solid 1px border of the Primary color and a subtle inner glow.

## Shapes

The shape language is predominantly architectural. A **Soft (0.25rem)** roundedness is the standard across the system, providing just enough refinement to feel modern without losing the "utility-first" brutalist edge. 

Larger containers (cards, windows) may use the base roundedness, while internal components like input fields and tags should remain sharp or near-sharp. Progress bars and indicators should never be fully rounded (pill-shaped), as this contradicts the technical, precision-oriented aesthetic.

## Components

- **Buttons:** Primary buttons use a solid Icy Cyan fill with black text for maximum punch. Secondary buttons should be ghost-style with a 1px Steel Blue border that brightens on hover.
- **Cards:** Use a semi-transparent "glass" background with a 1px border. The header of the card should be separated by a thin horizontal rule to mimic a terminal window header.
- **Lists:** Data lists should use monospace fonts for values. Row hover states should utilize a subtle background tint (#ffffff at 5% opacity) rather than a color shift.
- **Input Fields:** Styled as "inset" boxes with a dark background and a high-contrast bottom border. Labels should be placed above the field in a small, uppercase monospace font.
- **Status Chips:** Small, rectangular indicators with sharp corners. Use color-coded borders (Cyan for active, Red for error, Steel Blue for idle) rather than solid fills to maintain the airy, technical look.
- **Terminal View:** A specific component for raw logs or command input. It features a solid black background, no rounded corners, and a blinking underscore cursor.