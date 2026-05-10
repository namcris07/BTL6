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
   git clone https://github.com/namcris07/BTL6.git
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

## Multiplayer On 2 Different Machines (LAN)

1. Start host machine with:
  ```bash
  pnpm dev
  ```
2. Find host machine LAN IP (example: `192.168.1.10`) and open:
  ```
  http://192.168.1.10:3000
  ```
3. On guest machine, open the same LAN URL above.
4. In game menu:
  - Host machine: `Host Game` and share Host ID
  - Guest machine: `Join Game` and paste Host ID

If you copy a link that contains `localhost`, it only works on the same machine.
If an address like `172.21.x.x` is a virtual adapter or WSL/Docker network, it may not work from another device. Use the LAN/Wi-Fi adapter IP instead.

### Optional PeerJS Signaling Configuration

By default, PeerJS cloud signaling is used. You can override it with Vite env vars:

```bash
VITE_PEER_HOST=your-peer-server-host
VITE_PEER_PORT=443
VITE_PEER_PATH=/
VITE_PEER_SECURE=true
VITE_PEER_DEBUG=1
```

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

---

## README DEMO (Tiếng Việt) — Chuẩn bị thuyết trình

Tên game: **Neon Ninja Arena**

Mô tả ngắn: Neon Ninja Arena là một game đấu trường ninja theo phong cách cyberpunk, hiển thị dưới dạng 3D, cho phép chơi nhiều người (P2P) hoặc chơi đơn với bot thông minh.

**Engine / Stack chính:**
- Frontend: React + TypeScript
- 3D rendering: Three.js
- UI: Mantine
- Networking: PeerJS (WebRTC, peer-to-peer)
- Build: Vite, package manager: PNPM

-- Cách chơi & Mục tiêu --
- Mục tiêu: Loại bỏ đối thủ, đạt target kill hoặc giữ thời gian tốt nhất khi hết giờ.
- Controls:
  - Di chuyển: WASD
  - Nhắm/Look: Chuột (player quay về hướng con trỏ)
  - Đòn cơ bản: Left Click
  - Teleport: Giữ & nhả `Q` (aim rồi teleport)
  - Homing Missile: `Space` (bắn tên lửa nhào theo mục tiêu)
  - Laser Beam: `E` (bắn tia thẳng về hướng con trỏ)
  - Invincibility (bất tử tạm thời): `R`
  - Tab: Mở scoreboard; Esc: Mở Settings

-- Kỹ năng (Skills) và cách dùng --
- Teleport (Q): nhắm vị trí bằng chuột, giữ Q để chuẩn bị, thả để dịch chuyển ngay lập tức; dùng để truy đuổi hoặc thoát hiểm.
- Homing Missile (Space): bắn một tên lửa tự tìm mục tiêu trong phạm vi, gây sát thương diện rộng khi trúng.
- Laser Beam (E): bắn tia xuyên thẳng, gây sát thương cao trên đường đi.
- Invincibility (R): kích hoạt bất tử tạm thời trong vài giây, vô hiệu hóa sát thương.

-- Items (Chức năng) --
- First-aid-kit / Health Pack: hồi máu (tăng HP ngay lập tức).
- Shield: chặn một số lần trúng đòn (block hits).
- Damage Boost: tăng sát thương trong thời gian ngắn.
- Speed-boost: tăng tốc di chuyển tạm thời.

-- AI (Bot Archetypes) --
Bots hiện có 3 archetype:
- Aggressive: tấn công mạnh, ưu tiên truy đuổi mục tiêu gần nhất (thích rượt, nguy hiểm với người chơi yếu).
- Defensive: giữ khoảng cách, tập trung né tránh và dùng kỹ năng phòng thủ nhiều hơn.
- Balanced: pha trộn tấn công/defend — hành vi trung bình.

-- Các phần bắt buộc (điểm chấm / kiểm tra) — trạng thái hiện tại
- 3D (3đ): ĐÃ có — sử dụng Three.js để render arena và nhân vật.
- Network (3đ): ĐÃ có — Peer-to-peer bằng PeerJS, lobby/host/join, chia sẻ Host ID để kết nối.
  - Chế độ nhiều người chơi: Có thể hợp tác hoặc đấu (free-for-all). Host tạo phòng, khách join theo Host ID.
- AI + Game (4đ): ĐÃ có — các mục chi tiết:
  - Chế độ 1 player với bot cơ bản (enemy di chuyển và tấn công): ĐÃ có (+1đ)
  - Item giúp nâng cấp sức mạnh (health / shield / damage / speed): ĐÃ có (+1đ)
  - Enemy có nhiều chủng loại và hành vi (Aggressive / Defensive / Balanced): ĐÃ có (+2đ)

— Vậy các phần bắt buộc đã đầy đủ theo rubric.

-- Cài đặt và tùy chỉnh thời gian trận --
- Các cấu hình thời gian chính nằm ở `src/common/constants.ts`:
  - `WARMUP_COUNTDOWN_DURATION` — thời gian đếm ngược trước khi bắt đầu (ms)
  - `MATCH_TIMER_DURATION` — thời lượng trận khi dùng chế độ hẹn giờ (ms)
  - `FREEZE_TIME_DURATION` — thời gian freeze (ms) trước khi cho phép di chuyển
  
Ví dụ: đặt trận 3 phút → sửa `MATCH_TIMER_DURATION: 180000` (tính bằng milliseconds). Sau khi chỉnh, khởi lại dev server: 
```
pnpm dev
```

-- Phần Settings (in-game) --
- Mở bằng `Esc` (hoặc từ menu). `Settings` cho phép:
  - Điều chỉnh Music Volume và SFX Volume
  - Điều chỉnh Camera Sensitivity
  - Nút Exit Game / Back

Các setting này điều khiển `AudioManager` và `GameClient` (xem: `src/components/Settings.tsx`).

-- File quan trọng để tham khảo nhanh --
- Cấu hình trận & thời gian: `src/common/constants.ts`
- Logic server/host: `src/server/GameServer.ts` (bắt đầu trận, warmup, freeze, tick loop)
- Hiển thị trạng thái game / countdown: `src/components/GameModeDisplay.tsx`
- Settings UI: `src/components/Settings.tsx`

-- Cách demo (gợi ý cho buổi trình bày)
1. Chạy project: `pnpm install` → `pnpm dev`.
2. Mở 2 cửa sổ trình duyệt (hoặc 2 máy trên LAN). Trên 1 cửa sổ click `Host Game` → copy Host ID.
3. Bên còn lại chọn `Join Game` → dán Host ID → vào lobby.
4. Host nhấn `Start Game` (hoặc chờ warmup countdown). Trình diễn: skill, item pickup, bot behaviours.

-- Ghi chú cho thầy / câu hỏi hay gặp
- Nếu Host dùng `localhost` thì link chỉ hoạt động trên cùng máy; để chơi LAN, mở trang bằng IP LAN máy host (ví dụ `http://192.168.1.10:3000`).
- WebRTC yêu cầu HTTPS trên host ngoài local; dùng hosting có HTTPS để test production.

