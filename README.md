# Neon Ninja Arena

A cyberpunk-themed multiplayer 3D ninja battle arena game where players fight in a neon-lit futuristic cityscape using various skills and abilities to defeat opponents.

# Features

- Real-time Multiplayer mode: Peer-to-peer networking for low-latency gameplay
- Single player mode: Smart bots implementation. Have aggressive mode, defensive mode, and balanced mode
- Ninja-themed characters with unique abilities
- Multiple skills: Teleport, Homing Missile, Laser Beam, Invincibility
- Multiple powerups: Shield, Damage Boost, First-aid-kit, Speed-boost
- Handling graceful termination (host) / disconnection (visitors)
- Dynamic sound effects for powerup effects, skill usages, respawns, etc. and modern background theme
- Responsive design for various screen sizes

# Tech Stack

- **Frontend**: React 19, TypeScript
- **3D Rendering**: Three.js
- **Networking**: PeerJS for WebRTC connections
- **UI Components**: Mantine
- **Build Tools**: Vite, PNPM
- **Deployment**: Cloudflare Pages

# Getting Started

## Prerequisites

- Node.js >=22.12.0
- PNPM 10.0.0+

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Frankie2030/Game-Programming-A5
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Start the development server:
   ```bash
   pnpm dev
   ```

4. Open your browser and navigate to `http://localhost:3000`

## Building for Production

```bash
pnpm build
```

The built files will be in the `dist` directory.

# Controls
| Action | Control |
|--------|---------|
| Move | **WASD** keys |
| Look/Aim | **Mouse cursor** (player faces cursor)|
| Basic Attack | Left-mouse click |
| Teleport | Q |
| Homing Missile | Space |
| Laser Beam | E |
| Invincibility | R |
| Settings | Esc |

# Deployment
[TBC]

**Important**: WebRTC (PeerJS) requires HTTPS, which all modern hosting platforms provide by default.

# Checklist

## Core Loop
- [X] Spawn into a shared arena
- [X] Implement movement system
- [X] Implement power-up collection
- [X] Implement interactions with players/bots (combat or collision)
- [X] Design scoring model (frags / survival time / orbs)
- [X] Display live HUD with scores/status
- [X] Implement session timer OR target-score rule
- [X] Create end-of-session scoreboard
- [X] Implement transition back to lobby

---

## Controls & Camera
- [X] Keyboard/mouse controls (WASD + mouse look)
- [X] Twin-stick mode (keyboard + mouse)
- [X] Configurable sensitivity settings
- [X] Implement camera (top-down / isometric / light-perspective)
- [X] Clamp camera within arena bounds
- [X] Smooth follow camera logic
- [X] Mobile controls (optional)
  - [X] On-screen joystick
  - [X] On-screen action buttons
  - [X] Responsive UI scaling

---

## 3D Presentation
- [X] Use 3D-capable pipeline (real 3D or 2.5D impostors)
- [X] Add simple lighting & basic shadows
- [X] Maintain consistent world scale across assets
- [X] Implement minimap or player indicator

---

## Networking
- [X] Implement real-time networking (WebSockets / WebRTC)
- [X] Make server authoritative for state updates
- [X] Create lobby/room system
  - [X] Create room
  - [X] Join room
  - [X] View player list    => Click tab to see 
  - [X] Kick/leave features => Leave
  - [X] Round-based session persistence
- [X] Implement server tick loop (~10–20 Hz)
- [X] Implement client rendering at 60 FPS with interpolation
- [X] Validate & reject illegal actions server-side
- [X] Implement graceful disconnection handling
  - [X] Host disconnection: Notify all players and return to menu
  - [X] Player disconnection: Notify remaining players with username

---

## AI + Game

### Single-player Mode
- [X] Create single-player mode (player + AI bots only)
- [X] Ensure bots have basic movement/attack competency

### Items / Power-Ups
- [X] Add power-up items (speed / attack / HP / size / etc.)
- [X] Implement pickup effects
- [X] Implement expiry feedback (timer, visual cue)

### Multiple Bot Archetypes
- [X] Light/Fast chaser bot
- [X] Mid-range ranger bot
- [X] Heavy slow bruiser bot
- [X] Ensure distinct stats & behaviours

---

## Bonus (not implemented)
- [ ] Demonstrate a cheat (speedhack / value tampering / packet replay)
- [ ] Write mitigation strategy



# Acknowledgements

- [Three.js](https://threejs.org/) for 3D rendering
- [PeerJS](https://peerjs.com/) for WebRTC connections
- [Mantine](https://mantine.dev/) for UI components
- [Vite](https://vitejs.dev/) for fast development and building


# Credits
Victory Sound Effect: by <a href="https://pixabay.com/users/u_ss015dykrt-26759154/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=146260">u_ss015dykrt</a> from <a href="https://pixabay.com//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=146260">Pixabay</a>

Main Menu theme: by <a href="https://pixabay.com/users/onesevenbeatxs-38081472/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=328644">one seven</a> from <a href="https://pixabay.com/music//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=328644">Pixabay</a>

Respawn Sound Effect by <a href="https://pixabay.com/users/koiroylers-44305058/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=351714">Koi Roylers</a> from <a href="https://pixabay.com//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=351714">Pixabay</a>

Powerup Sound Effect by <a href="https://pixabay.com/users/ribhavagrawal-39286533/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=230548">Ribhav Agrawal</a> from <a href="https://pixabay.com//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=230548">Pixabay</a>