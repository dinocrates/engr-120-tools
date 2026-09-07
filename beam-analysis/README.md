# 📐 Beam Analysis Tool

An interactive, real-time beam analysis tool for structural calculations and visualization. Designed for statics courses, engineering education, and quick structural assessments.

## Features

- **Interactive Visualization**: Drag-and-drop interface for adding and positioning loads on beams
- **Multiple Beam Types**: 
  - Simply Supported (pin and roller supports)
  - Cantilever (fixed end support)
- **Load Types**:
  - Point loads (concentrated forces)
  - Distributed loads (uniform or linearly varying)
  - Moment loads (couples)
- **Real-Time Calculations**: 
  - Support reactions (RA, RB)
  - Shear force diagrams
  - Bending moment diagrams
  - Maximum moment values
- **Unit System Toggle**: Switch between metric (N, m) and imperial (lb, in) units
- **Visual Feedback**: Color-coded loads with interactive selection and modification
- **Responsive Design**: Works on desktop and mobile devices

---

## How to Use

### Adding Loads

1. **Select Load Type** from the left palette:
   - **Point Load** (downward force)
   - **Distributed Load** (spread over a distance)
   - **Moment Load** (rotational force)

2. **Drag the load** onto the beam diagram
   - The load will snap to the beam position
   - Each load is assigned a unique color

3. **Position & Modify**:
   - **Drag** loads along the beam to reposition them
   - **For distributed loads**: Drag the left/right edges to adjust span
   - **Double-click** a load to select it and modify its magnitude

### Adjusting Parameters

- **Beam Length (L)**: Set via input field at top
- **Load Magnitudes**: 
  - Use palette controls to set default values before dragging
  - Click on selected loads to edit values in the selection bar
  - Magnitudes are shown in the palette and update in real-time

### Toggling Settings

- **Beam Type**: Click "Simply Supported" or "Cantilever" buttons
  - Affects how reactions are calculated
  - Updates support conditions in diagram

- **Unit System**: Click "Metric" or "Imperial"
  - Metric: Newtons (N) and meters (m)
  - Imperial: Pounds (lb) and inches (in)
  - All values auto-convert

### Viewing Results

**Three key values display in real-time:**

- **RA (Left Reaction)**: Vertical reaction force at left support
- **RB (Right Reaction)**: Vertical reaction force at right support (zero for cantilevers)
- **Mmax (Max Moment)**: Peak bending moment magnitude on the beam

**Two Diagrams:**

1. **Shear Force Diagram** (SFD): Shows internal shear stress distribution along the beam
2. **Bending Moment Diagram** (BMD): Shows internal moment distribution along the beam

### Managing Loads

- **Select a Load**: Click on it in the diagram (it highlights)
- **Delete Selected**: 
  - Press Delete or Backspace key
  - Or click the delete button in the selection bar
- **Clear All**: "Clear All" button removes all loads at once
- **Deselect**: Press Escape or click empty beam area

---

## Calculations

The tool performs standard beam theory calculations:

### Simply Supported Beam
- **Reactions**: Using equilibrium equations (ΣF = 0, ΣM = 0)
- **Shear & Moment**: Computed at intervals along the beam length
- **Diagrams**: Generated from load distributions

### Cantilever Beam
- **Fixed End Reaction**: Moment and vertical force at fixed support
- **Free End**: No reactions, only internal stresses
- **Diagrams**: Shear and moment functions computed from fixed end

### Load Types

**Point Load (P)**
- Applied vertically downward at a single position
- Creates discontinuity in shear diagram
- Linear change in moment diagram

**Distributed Load (w)**
- Can be uniform (w1 = w2) or triangular (w1 ≠ w2)
- w1: Load intensity at left end
- w2: Load intensity at right end
- Creates parabolic moment diagram

**Moment Load (M)**
- Pure couple (no vertical force component)
- Creates discontinuity in moment diagram only
- No effect on shear diagram

---

## Controls & Keyboard Shortcuts

| Action | Method |
|--------|--------|
| Drag load | Click and hold load tile, drop on beam |
| Reposition load | Click and drag load on beam |
| Resize distributed load | Drag left/right edges |
| Select load | Click on beam element |
| Delete selected | Delete or Backspace key |
| Deselect all | Escape key |
| Change beam type | Click beam type button |
| Toggle units | Click Metric/Imperial button |

---

## Technical Details

### Browser Compatibility
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Requires JavaScript enabled
- Canvas API for diagram rendering
- SVG for beam visualization

### Performance
- Supports up to ~20 loads before performance degrades
- Real-time updates on load modifications
- Optimized diagram redraws

### Precision
- Calculations use IEEE 754 floating-point (typical precision: 10⁻¹⁵)
- Results displayed to 2-3 significant figures
- Moment values shown with appropriate precision

---

## Limitations & Assumptions

- **Linear Elastic Material**: Follows Hooke's Law
- **Small Deflections**: Assumes deflections are negligible compared to beam length
- **Uniform Cross-Section**: Beam properties constant along length
- **No Axial Loading**: Only vertical loads considered
- **2D Analysis**: Plane stress/strain only
- **Static Loads**: No dynamic or time-dependent analysis
- **Maximum Loads**: Limited to ~20 concurrent loads for UI performance

---

## Educational Use

### Ideal for:
- Statics and Strength of Materials courses
- Engineering design verification
- Structural analysis homework
- Quick "what-if" scenarios
- Understanding load effects on beam behavior

### Learning Activities:
1. Predict reactions before calculating
2. Observe how distributed loads differ from point loads
3. Understand shear and moment diagrams intuitively
4. Experiment with cantilever vs. simply supported behavior
5. Analyze composite loading scenarios

---

## Tips & Tricks

- **Unit Conversion**: Set your default loads in one unit system, then toggle to see imperial equivalents
- **Symmetry**: For symmetric loads on simply supported beams, reactions should be equal
- **Cantilever Diagrams**: Fixed end has maximum moment; free end has zero
- **Distributed Loads**: Triangle with base = beam span creates maximum moment at center
- **Moment Loads**: Don't affect reactions on simply supported beams (in global equilibrium)

---

## File Structure

```
index.html
├── HTML Structure
├── Embedded CSS (responsive dark theme)
├── JavaScript
│   ├── Beam calculation engine
│   ├── Drag-drop interaction handler
│   ├── SVG/Canvas rendering
│   └── Unit conversion utilities
└── No external dependencies
```

**Standalone File**: Everything is self-contained in a single HTML file. Just open in a browser—no installation needed.

---

## Author Notes

Built for engineering education with a focus on:
- **Intuitive UX**: Drag-and-drop mimics physical reasoning
- **Real-time Feedback**: Instant visualization of changes
- **Visual Learning**: Diagrams build understanding
- **Accessibility**: Dark theme, clear labels, keyboard support

---

## Future Enhancements

Potential additions for expanded functionality:
- Beam with overhang support
- Multiple span continuous beams
- Angled loads
- Shear and moment equations display
- Deflection calculations
- Material library
- Export diagrams as images
- Save/load scenarios

---

## Support & Feedback

For bug reports, suggestions, or questions about specific calculations, please verify:
1. Load magnitudes are within reasonable range (extreme values may cause numerical issues)
2. Beam length is positive
3. Distributed loads span is within beam length
4. Browser supports modern JavaScript (ES6+)

---

**Happy analyzing!** 📊
