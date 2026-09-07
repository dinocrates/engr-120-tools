# Pneumatic Circuit Simulator — Software Design Document

**Status:** Initial Design
**Primary Audience:** Engineering and technology students
**Primary Use Case:** Creation, simulation, animation, and control of pneumatic circuits in an instructional environment

This is the reference design. See [README.md](README.md) for what is actually
implemented today and how the code is organized.

---

# 1. Purpose

The Pneumatic Circuit Simulator is an interactive educational application that allows students to:

1. Create pneumatic circuit diagrams using standard pneumatic components and symbols.
2. Connect components using pneumatic lines.
3. Simulate the logical and physical behavior of the completed pneumatic system.
4. Manually operate valves and controls while the simulation is running.
5. Observe cylinders, valves, pressure states, and airflow behavior through animation.
6. Troubleshoot incorrectly designed pneumatic circuits.
7. Experiment with circuit modifications without requiring physical pneumatic hardware.

The simulator is intended primarily as a teaching and learning tool rather than a high-fidelity computational fluid dynamics package.

The system should emphasize:

* circuit logic,
* component behavior,
* actuator sequencing,
* pressure availability,
* valve states,
* signal flow,
* troubleshooting,
* and visualization.

The simulator should be intuitive enough for introductory students while supporting circuits complex enough for courses in automation, mechatronics, manufacturing, and engineering technology.

---

# 2. Design Goals

The simulator should satisfy the following major design goals.

## 2.1 Easy Circuit Construction

Students should be able to construct pneumatic systems by dragging components onto a workspace and connecting component ports.

Creating a basic circuit should require little or no knowledge of the software itself.

For example, a student should be able to construct:

**Compressor / Supply → 3/2 Valve → Single-Acting Cylinder → Exhaust**

within a few minutes.

---

## 2.2 Standard Pneumatic Representation

Components should visually resemble standard pneumatic schematic symbols.

Where practical, symbols should follow ISO 1219 conventions.

Students should learn to recognize real pneumatic diagrams rather than learning a simulator-specific graphical language.

---

## 2.3 Interactive Simulation

The completed diagram should become interactive when simulation begins.

Students should be able to:

* press pushbuttons,
* move manual valves,
* toggle switches,
* activate solenoids,
* trigger limit switches,
* manipulate sensors,
* and change supply conditions.

The pneumatic circuit should immediately respond.

---

## 2.4 Visual Feedback

The simulator should make normally invisible pneumatic behavior visible.

Examples include:

* pressurized lines changing appearance,
* exhaust paths becoming visible,
* cylinders extending and retracting,
* valve spools shifting,
* pressure indicators changing,
* flow arrows appearing,
* and sensors activating.

The goal is to help students understand **why** the system behaves the way it does.

---

## 2.5 Educational Accuracy

The simulator should accurately represent the logical behavior of common pneumatic components without requiring computationally expensive physical modeling.

The initial simulator should prioritize:

1. correct topology,
2. correct valve behavior,
3. pressure propagation,
4. actuator state,
5. sequencing,
6. and control logic.

Detailed compressible-fluid modeling may be added later.

---

# 3. Scope

## 3.1 Initial Scope

The first production version should support:

* pneumatic supply,
* exhaust,
* directional control valves,
* manual controls,
* solenoids,
* pneumatic pilots,
* single-acting cylinders,
* double-acting cylinders,
* flow-control valves,
* check valves,
* pressure regulators,
* pressure gauges,
* limit valves,
* basic sensors,
* and pneumatic connections.

Students should be able to build, save, load, run, pause, reset, and modify circuits.

---

## 3.2 Future Scope

Potential future additions include:

* electro-pneumatic control,
* ladder logic,
* PLC integration,
* Boolean logic control,
* proportional valves,
* pressure losses,
* flow calculations,
* cylinder forces,
* realistic velocity calculations,
* vacuum systems,
* pneumatic motors,
* fault insertion,
* instructor-created assignments,
* automatic circuit checking,
* and hardware-in-the-loop control.

These features should not be required for the first implementation, but the software architecture should not prevent them from being added.

---

# 4. User Workflow

A typical student workflow should be:

### Step 1 — Create Circuit

The student opens a blank pneumatic workspace.

### Step 2 — Add Components

The student selects components from a component library and places them on the diagram.

### Step 3 — Connect Components

The student connects ports using pneumatic lines.

### Step 4 — Configure Components

The student may change component properties such as:

* actuator type,
* spring return,
* valve initial position,
* cylinder stroke,
* regulator pressure,
* orifice size,
* or component label.

### Step 5 — Validate Circuit

The simulator checks the circuit for obvious errors.

Examples:

* unconnected required ports,
* supply connected directly to exhaust,
* impossible actuator configuration,
* disconnected cylinder chambers,
* duplicated connections,
* unsupported component combinations.

### Step 6 — Start Simulation

The student selects **Run**.

The circuit enters simulation mode.

### Step 7 — Interact With Circuit

The student can operate controls.

For example:

* press a pushbutton,
* activate a lever,
* energize a solenoid,
* or trigger a sensor.

### Step 8 — Observe Response

The simulator updates:

* valve states,
* pressure paths,
* airflow,
* cylinder position,
* sensors,
* and other components.

### Step 9 — Pause or Reset

The student can pause the simulation to inspect the circuit or reset the system to its initial state.

---

# 5. User Interface

The application should use a workspace layout similar to common CAD and circuit simulation tools.

## 5.1 Main Interface

The primary screen should contain:

| Area                | Purpose                                  |
| ------------------- | ---------------------------------------- |
| Component Library   | Select pneumatic components              |
| Diagram Workspace   | Create and edit pneumatic circuits       |
| Properties Panel    | Modify selected components               |
| Simulation Controls | Run, pause, step, and reset              |
| Status Panel        | Show warnings and simulation information |

A possible layout is:

```text
+-------------------------------------------------------------+
| File | Edit | View | Simulation | Help                     |
+--------------+----------------------------------------------+
|              |                                              |
| Component    |                                              |
| Library      |             Diagram Workspace                |
|              |                                              |
| Supply       |                                              |
| Valves       |                                              |
| Cylinders    |                                              |
| Sensors      |                                              |
| Controls     |                                              |
|              |                                              |
+--------------+------------------------------+---------------+
| Simulation Controls                         | Properties    |
| [Run] [Pause] [Step] [Reset]                |               |
+---------------------------------------------+---------------+
```

---

# 6. Diagram Editor

The diagram editor is responsible for creating the pneumatic schematic.

## 6.1 Component Placement

Components should be draggable from the library onto the workspace.

Components should support:

* drag,
* rotate,
* move,
* copy,
* paste,
* duplicate,
* delete,
* and label.

Rotation should normally occur in 90-degree increments.

---

## 6.2 Port-Based Connections

Each pneumatic component should expose defined connection ports.

Examples:

### 3/2 Valve

* P — Pressure
* A — Working port
* R — Exhaust

### 5/2 Valve

* P — Pressure
* A — Working port
* B — Working port
* R — Exhaust
* S — Exhaust

### Double-Acting Cylinder

* A — Cap-side chamber
* B — Rod-side chamber

Connections should snap to ports.

Students should not be able to connect tubing to arbitrary portions of a component symbol.

---

## 6.3 Pneumatic Lines

Lines represent pneumatic connections.

A line should store:

* starting port,
* ending port,
* line type,
* pressure state,
* flow state,
* and optional metadata.

Initially, line length should have no effect on pneumatic behavior.

Future versions could optionally include line volume and pressure-loss effects.

---

# 7. Component Model

Every pneumatic component should derive from a common conceptual component interface.

A component should contain:

```text
Component
    id
    type
    position
    rotation
    ports[]
    state
    parameters
    visualRepresentation
```

Each component should implement simulation behavior.

Conceptually:

```text
initialize()
evaluate(inputs)
update(deltaTime)
reset()
getOutputs()
```

Not every component will require every operation.

---

# 8. Ports

Ports are the primary mechanism used to connect the pneumatic network.

A port should contain:

```text
Port
    id
    componentId
    type
    connection
    pressure
    flow
```

Possible port types include:

* pressure,
* working,
* exhaust,
* pilot,
* control,
* mechanical,
* electrical.

This distinction becomes particularly useful when electro-pneumatic components are added later.

---

# 9. Pneumatic Simulation Model

The simulator should initially use a **network-state model** rather than full fluid dynamics.

The pneumatic circuit is represented as a graph.

### Nodes

Component ports and connected pneumatic lines.

### Edges

Internal component pathways and external pneumatic connections.

The solver determines which pneumatic nodes are connected to:

* supply pressure,
* exhaust,
* trapped volume,
* or another active pneumatic region.

---

# 10. Pressure States

The initial simulation can use discrete pressure states.

For example:

```text
UNPRESSURIZED
PRESSURIZED
EXHAUSTING
TRAPPED
UNKNOWN
```

A more advanced implementation may store numerical pressure values:

```text
pressure = 0–1000 kPa
```

The discrete state model is sufficient for many introductory pneumatic circuits and significantly simplifies the simulation.

---

# 11. Simulation Cycle

Each simulation update should follow an ordered process.

## Phase 1 — Read Inputs

Determine the state of:

* pushbuttons,
* switches,
* sensors,
* solenoids,
* mechanical actuators,
* pneumatic pilots.

## Phase 2 — Determine Valve States

Evaluate each directional valve.

Examples:

* spring-return valve returns to normal position,
* pushbutton moves valve while pressed,
* detented valve remains in its last position,
* pneumatic pilot shifts when pilot pressure exists,
* solenoid shifts when energized.

## Phase 3 — Construct Active Flow Paths

Each valve position determines which ports are internally connected.

For example, a 5/2 valve may produce:

### Position 1

```text
P → A
B → Exhaust
```

### Position 2

```text
P → B
A → Exhaust
```

## Phase 4 — Propagate Pressure

The solver traces active connections from pressure sources through the circuit.

Connected regions inherit the appropriate pneumatic state.

## Phase 5 — Determine Actuator Forces

Cylinder chambers are evaluated.

For a double-acting cylinder:

```text
Cap Side Pressurized + Rod Side Exhausted
    → Cylinder Extends

Rod Side Pressurized + Cap Side Exhausted
    → Cylinder Retracts
```

If both sides are pressurized or trapped, movement depends on the selected simulation model.

## Phase 6 — Update Motion

Cylinder position changes based on its current motion state.

Example:

```text
position += velocity × deltaTime
```

## Phase 7 — Update Sensors

Mechanical or position sensors are evaluated.

For example:

```text
if cylinder.position >= 0.95:
    extendedLimitSwitch = ACTIVE
```

Sensor changes may cause additional valve changes.

## Phase 8 — Repeat Until Stable

Control changes may alter the pneumatic network.

The simulator should repeatedly evaluate the system until:

* the logical state becomes stable,
* or a configured iteration limit is reached.

This prevents infinite loops caused by unstable or contradictory circuits.

---

# 12. Directional Valve Model

Directional valves should be modeled as a collection of possible spool positions.

For example:

```text
DirectionalValve
    positions[]
    currentPosition
    actuators[]
    springReturn
```

Each position defines internal port connections.

Example 5/2 valve:

```text
Position 0:
    P -> A
    B -> R

Position 1:
    P -> B
    A -> S
```

This architecture allows many valves to be created from the same underlying component logic.

Examples:

* 2/2
* 3/2
* 4/2
* 4/3
* 5/2
* 5/3

---

# 13. Valve Actuation

Valves should support multiple actuator types.

## Manual

* pushbutton,
* lever,
* toggle,
* foot pedal.

## Mechanical

* roller,
* plunger,
* cam.

## Pneumatic

* single pilot,
* double pilot.

## Electrical

Future versions:

* single solenoid,
* double solenoid.

## Return Mechanisms

* spring return,
* pneumatic return,
* detent,
* opposing actuator.

---

# 14. Cylinder Simulation

## 14.1 Single-Acting Cylinder

Properties:

```text
stroke
position
speed
springReturn
port
```

Possible states:

```text
RETRACTED
EXTENDING
EXTENDED
RETRACTING
STOPPED
```

---

## 14.2 Double-Acting Cylinder

Properties:

```text
stroke
position
extensionSpeed
retractionSpeed
capPort
rodPort
```

The visual representation should show the piston rod physically moving.

---

# 15. Cylinder Animation

Cylinder position should be represented internally as a normalized value:

```text
0.0 = fully retracted
1.0 = fully extended
```

The rendered rod position can then be calculated from this value.

Example:

```text
rodOffset = cylinder.position × renderedStrokeLength
```

This allows animation speed and schematic size to remain independent.

---

# 16. Flow Control

Flow-control valves should influence actuator speed.

The first implementation does not need to calculate real volumetric flow.

Instead, a flow restriction may be represented as a multiplier.

Example:

```text
effectiveSpeed =
    baseCylinderSpeed × flowCoefficient
```

where:

```text
0.0 <= flowCoefficient <= 1.0
```

This allows students to observe the effects of meter-in and meter-out circuits without requiring a sophisticated fluid solver.

---

# 17. Check Valves

A check valve should permit pneumatic propagation in only one direction.

The solver should treat the component as a directional edge.

```text
A -> B permitted
B -> A blocked
```

Pilot-operated check valves may later allow this behavior to change based on pilot pressure.

---

# 18. Pressure Regulators

Pressure regulators should allow a downstream region to have a lower pressure than the main supply.

Example:

```text
Supply Pressure = 700 kPa
Regulator Setting = 400 kPa
Downstream Pressure = 400 kPa
```

This requires the solver to support numerical pressures even if most pneumatic behavior continues to use simplified state logic.

---

# 19. Exhaust

Exhaust ports should represent atmospheric pressure.

Exhaust-connected lines should visually indicate depressurization.

Optional animations could include:

* fading pressure color,
* animated flow arrows,
* or small exhaust indicators.

---

# 20. Visual Simulation States

Pneumatic lines should visually communicate their condition.

For example:

| State       | Visual Behavior                              |
| ----------- | -------------------------------------------- |
| Pressurized | Highlighted line                             |
| Exhaust     | Alternate highlight or animated exhaust flow |
| Trapped     | Distinct dashed or shaded state              |
| No Pressure | Standard schematic line                      |
| Active Flow | Moving arrows                                |

The specific colors should be configurable to support accessibility.

Color should not be the only mechanism used to communicate state.

Line thickness, animation, pattern, or icons should provide redundant information.

---

# 21. Component Animation

Components should visually change state during simulation.

Examples:

### Directional Valve

The active spool position is highlighted.

### Cylinder

Rod extends or retracts.

### Pushbutton

Button visibly depresses.

### Limit Switch

Switch changes position.

### Solenoid

Coil indicates energized state.

### Pressure Gauge

Needle moves to reflect pressure.

---

# 22. Simulation Controls

The simulation toolbar should contain:

```text
Run
Pause
Step
Reset
Simulation Speed
```

### Run

Continuously evaluates and animates the circuit.

### Pause

Stops time while preserving the current state.

### Step

Advances the simulation by one logical or time step.

This is particularly valuable for instruction and troubleshooting.

### Reset

Returns the circuit to its initial configuration.

---

# 23. Editing During Simulation

To reduce ambiguity, structural editing should normally be disabled while the simulation is running.

Students should still be able to operate controls.

To modify the circuit:

```text
Pause → Edit → Run
```

A future version may support live circuit modification.

---

# 24. Circuit Validation

Before simulation begins, the system should perform basic validation.

Possible warnings include:

```text
Cylinder port A is not connected.

Valve pressure port P has no pressure source.

Two pressure supplies with different pressures are connected.

Component contains an unsupported connection.

Pilot port is unconnected.

Circuit contains an isolated pneumatic network.
```

Warnings should distinguish between:

* errors that prevent simulation,
* and unusual configurations that are still physically possible.

---

# 25. Educational Diagnostics

The simulator should expose information useful for learning.

Selecting a pneumatic line could display:

```text
Pressure: 620 kPa
State: Pressurized
Flow Direction: Valve V1 → Cylinder C1
```

Selecting a valve could display:

```text
Valve: V1
Type: 5/2
Position: Left
Actuation: Pushbutton
Return: Spring

Current Connections:
P → A
B → R
```

Selecting a cylinder could display:

```text
Position: 72%
Direction: Extending
Cap Pressure: 600 kPa
Rod Pressure: Atmospheric
```

---

# 26. Explain Mode

A future educational feature should provide an **Explain** function.

Students could select a component and ask the simulator why it is in its current state.

Example:

```text
Cylinder C1 is extending because:

1. Valve V1 is currently shifted.
2. Supply port P is connected to port A.
3. Port A is connected to the cap side of C1.
4. The rod side is connected to exhaust.
```

This feature would make the simulator substantially more useful as an instructional tool.

---

# 27. Component Library

The initial component library should include the following.

## Supplies

* compressed-air source,
* service unit / FRL,
* pressure regulator,
* pressure gauge,
* exhaust / atmosphere.

## Directional Valves

* 2/2 valve,
* 3/2 valve,
* 4/2 valve,
* 5/2 valve,
* 5/3 valve.

## Valve Actuation

* pushbutton,
* lever,
* roller,
* spring,
* pneumatic pilot,
* solenoid.

## Actuators

* single-acting cylinder,
* double-acting cylinder.

## Flow Components

* check valve,
* adjustable flow restriction,
* one-way flow-control valve,
* quick exhaust valve.

## Logic Components

Future versions may include:

* shuttle valve / OR,
* two-pressure valve / AND,
* time-delay valve.

## Sensors

* mechanical limit valve,
* pressure switch,
* proximity sensor.

---

# 28. Data Model

A circuit should be serializable to a portable format such as JSON.

Example:

```json
{
  "version": 1,
  "components": [
    {
      "id": "V1",
      "type": "5_2_valve",
      "position": { "x": 340, "y": 220 },
      "rotation": 0,
      "properties": {
        "actuator": "manual_button",
        "return": "spring"
      }
    }
  ],
  "connections": [
    {
      "from": { "component": "SUPPLY1", "port": "P" },
      "to": { "component": "V1", "port": "P" }
    }
  ]
}
```

This allows diagrams to be:

* saved,
* shared,
* submitted,
* automatically graded,
* or embedded in course materials.

---

# 29. Software Architecture

The application should separate diagram editing from simulation logic.

A recommended architecture is:

```text
User Interface
      │
      ▼
Diagram Model
      │
      ▼
Circuit Graph
      │
      ▼
Simulation Engine
      │
      ▼
Component States
      │
      ▼
Animation / Rendering
```

Major subsystems should include:

```text
Diagram Editor
Component Library
Circuit Serializer
Circuit Validator
Simulation Engine
Animation Engine
User Interaction Manager
Assignment / Assessment Layer
```

---

# 30. Diagram Editor Architecture

The editor should maintain a model independent of the graphics displayed on screen.

For example:

```text
Visual Component
      ↕
Component Model
      ↕
Simulation Component
```

Separating these responsibilities prevents graphical behavior from becoming tightly coupled to pneumatic simulation logic.

---

# 31. Simulation Engine Architecture

The simulation engine should operate entirely from the circuit model.

It should not depend on screen coordinates or graphical rendering.

Inputs:

```text
Circuit
Component States
User Inputs
Elapsed Time
```

Outputs:

```text
Component States
Port Pressures
Flow States
Actuator Positions
Events
```

---

# 32. Event System

An internal event system should allow components to communicate changes efficiently.

Potential events include:

```text
ValveChanged
PressureChanged
CylinderMoved
SensorActivated
SolenoidChanged
SimulationStarted
SimulationPaused
SimulationReset
```

The renderer can listen for these events and update the appropriate animation.

---

# 33. Solver Approach

The pneumatic solver should operate similarly to a circuit connectivity solver.

For each simulation cycle:

```text
1. Determine component states.
2. Generate active pneumatic connections.
3. Create connectivity graph.
4. Identify supply nodes.
5. Propagate supply pressure.
6. Identify exhaust nodes.
7. Determine trapped regions.
8. Update actuator forces.
9. Advance moving components.
10. Update sensors.
11. Repeat if sensor state changes.
```

This design avoids requiring continuous numerical fluid calculations for every pneumatic line.

---

# 34. Example Circuit Evaluation

Consider:

```text
Supply
  │
  ▼
5/2 Pushbutton Valve
 │                 │
 A                 B
 │                 │
 ▼                 ▼
Cap              Rod
 \                /
 Double-Acting Cylinder
```

When the button is not pressed:

```text
P → B
A → Exhaust
```

The cylinder retracts.

When the student presses the button:

```text
P → A
B → Exhaust
```

The cylinder extends.

When the button is released:

the spring returns the valve and the cylinder retracts.

The interface should animate all three behaviors:

* button press,
* spool shift,
* cylinder motion.

---

# 35. Time Model

The simulator should distinguish between:

### Logical State

Which paths are currently active.

### Physical Time

How long mechanical motion takes.

Valve switching may occur nearly instantaneously from the student's perspective.

Cylinder movement should occur over simulated time.

Example:

```text
Logical update:
Valve switches immediately.

Physical update:
Cylinder moves from 0% to 100% over 1.5 seconds.
```

---

# 36. Simulation Speed

Students should be able to adjust simulation speed.

Suggested options:

```text
0.25×
0.5×
1×
2×
4×
```

Slow motion will be particularly useful when teaching sequencing circuits.

---

# 37. Fault Simulation

A later version should allow instructors to insert faults such as:

* blocked line,
* leaking cylinder,
* stuck valve,
* insufficient pressure,
* disconnected tube,
* failed solenoid,
* partially closed flow control,
* failed sensor.

Students could then troubleshoot the circuit.

This would allow the simulator to support laboratory-style diagnostic assignments.

---

# 38. Instructor Features

The simulator should eventually support instructor-created activities.

An assignment could contain:

```text
Starter Circuit
Allowed Components
Required Behavior
Hidden Tests
Student Instructions
```

Example:

> Modify the circuit so that the cylinder extends when PB1 is pressed and automatically retracts when the extended limit valve is activated.

The simulator could automatically test the finished circuit.

---

# 39. Automatic Assessment

Because the circuit exists as structured data, assignments may eventually be automatically checked.

Assessment could evaluate:

### Topology

Are required components present?

### Connectivity

Are components connected correctly?

### Behavior

Does the circuit produce the required sequence?

### Restrictions

Did the student avoid prohibited components?

Behavior-based assessment should generally be preferred over checking for one exact circuit.

Students should be allowed to create different valid solutions.

---

# 40. Example Automated Test

An assignment might specify:

```text
Initial state:
Cylinder must be retracted.

Input:
Press PB1.

Expected:
Cylinder begins extending.

Input:
Release PB1.

Expected:
Cylinder continues extending.

Condition:
Extended sensor activates.

Expected:
Cylinder retracts.
```

The simulator could automatically operate controls and verify the resulting states.

---

# 41. Accessibility

The interface should support:

* keyboard navigation,
* high-contrast rendering,
* scalable symbols,
* screen-reader labels,
* configurable animation,
* reduced-motion mode,
* and non-color state indicators.

Every component should have a readable textual description.

For example:

```text
V1: 5-port, 2-position directional valve,
manual pushbutton actuation,
spring return.
```

---

# 42. Platform

A browser-based implementation is preferred.

Advantages include:

* no installation,
* Windows/macOS/Linux compatibility,
* Chromebook support,
* simple updates,
* compatibility with online courses,
* easy LMS linking,
* and potential offline caching.

A likely implementation stack could include:

```text
TypeScript
HTML/CSS
SVG or Canvas rendering
Browser-based simulation engine
JSON circuit files
```

SVG is particularly attractive for schematic rendering because pneumatic symbols consist primarily of lines, geometric shapes, and text.

SVG elements are also individually addressable, making interaction and animation easier than with a single bitmap canvas.

---

# 43. Recommended Rendering Approach

A hybrid approach is recommended:

### SVG

Use for:

* pneumatic symbols,
* ports,
* tubing,
* labels,
* selection highlighting.

### CSS / SVG Animation

Use for:

* valve movement,
* button presses,
* highlighting,
* simple cylinder movement.

### JavaScript / TypeScript Animation Loop

Use for:

* cylinder position,
* pressure updates,
* simulation timing.

---

# 44. Component Definition System

Pneumatic components should ideally be data-driven.

For example:

```text
ValveDefinition
    name
    symbol
    ports
    positions
    internalConnections
    allowedActuators
```

This would make it possible to add new valve types without creating entirely new simulator code.

For example:

```json
{
  "type": "3_2_valve",
  "ports": ["P", "A", "R"],
  "positions": [
    { "connections": [["A", "R"]] },
    { "connections": [["P", "A"]] }
  ]
}
```

---

# 45. State Machine Model

Many pneumatic components can naturally be represented as finite-state machines.

For example:

```text
5/2 Spring Return Valve

NORMAL
   |
   | button pressed
   ▼
ACTUATED
   |
   | button released
   ▼
NORMAL
```

A double-piloted valve may instead behave as:

```text
POSITION_A
    |
    | right pilot
    ▼
POSITION_B
    |
    | left pilot
    ▼
POSITION_A
```

This model is particularly useful for valves with memory or detents.

---

# 46. Separation of Logical and Physical Models

The architecture should explicitly separate:

## Pneumatic Logic

Which ports are connected?

## Pressure Model

What pressure exists at each port?

## Mechanical Model

How do cylinders and mechanical actuators move?

## Control Model

What causes valves to switch?

## Visualization Model

How are those states displayed to the student?

This separation will allow the simulator to become more sophisticated without requiring a complete rewrite.

---

# 47. Development Phases

## Phase 1 — Diagram Editor Prototype

Implement:

* workspace,
* drag-and-drop components,
* component movement,
* ports,
* pneumatic connections,
* save/load.

Components:

* pressure source,
* exhaust,
* 3/2 valve,
* 5/2 valve,
* double-acting cylinder.

---

## Phase 2 — Logical Pneumatic Simulation

Implement:

* valve state,
* pressure propagation,
* exhaust propagation,
* cylinder direction,
* reset.

At this stage, cylinders may change state instantly.

---

## Phase 3 — Animation

Implement:

* timed cylinder movement,
* spool movement,
* pushbutton animation,
* pressure highlighting,
* flow indicators.

---

## Phase 4 — Expanded Component Library

Add:

* single-acting cylinders,
* flow-control valves,
* check valves,
* pneumatic pilots,
* mechanical limit valves,
* regulators,
* gauges.

---

## Phase 5 — Educational Features

Add:

* simulation stepping,
* component state inspection,
* circuit validation,
* explanation mode,
* fault insertion.

---

## Phase 6 — Assessment System

Add:

* assignment definitions,
* starter circuits,
* automatic behavior testing,
* scoring,
* submission format.

---

## Phase 7 — Electro-Pneumatics

Add:

* electrical switches,
* relay logic,
* solenoids,
* sensors,
* optional ladder logic,
* and eventually PLC control.

---

# 48. Minimum Viable Product

The MVP should demonstrate one complete pneumatic workflow.

A student should be able to:

1. Place an air supply.
2. Place a 5/2 spring-return pushbutton valve.
3. Place a double-acting cylinder.
4. Connect the components.
5. Start simulation.
6. Press the valve button.
7. Watch pressure shift through the circuit.
8. Watch the cylinder extend.
9. Release the button.
10. Watch the valve return.
11. Watch the cylinder retract.

If this experience works smoothly, the fundamental architecture of the simulator has been proven.

---

# 49. Success Criteria

The simulator should be considered successful when a student with minimal software instruction can:

* reproduce a pneumatic circuit from a schematic,
* correctly connect pneumatic components,
* operate the simulated system,
* observe and interpret component states,
* identify the cause of actuator motion,
* modify the circuit,
* and test the modified design.

The simulator should make pneumatic circuit behavior **more understandable than the static schematic alone**.

---

# 50. Long-Term Vision

The long-term goal is a browser-based automation laboratory where students can move progressively from:

```text
Pneumatic Components
        ↓
Pneumatic Logic
        ↓
Electro-Pneumatics
        ↓
Relay Logic
        ↓
PLC Control
        ↓
Automated Machines
```

A pneumatic simulator built around a component graph and state-based simulation engine provides the foundation for all of these later capabilities.

Rather than creating a simple animated drawing program, the application should become an interactive virtual trainer in which the schematic itself functions as the simulated machine.
