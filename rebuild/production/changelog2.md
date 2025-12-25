# UI Changes Log (2025-12-24)

## 1. Game Session Page (`GameSession.tsx`)
- **Game Phase Indicator**: 
  - Changed layout to horizontal (flex-row).
  - Removed explicit "Phase" text.
  - Adjusted spacing between "Current Round" and phase status.
- **Connection Status**:
  - Fixed "LIVE"/"OFFLINE" indicator dot display (green/red glow).
- **AI Recommendations**:
  - Forced left alignment for text inside AI recommendation buttons.
- **Decision Submission**:
  - Increased vertical spacing before the "Submit Decision" button.
- **System Controls**:
  - Centered "Archive Management" and "Refresh Status" buttons.
- **Player Information Panel**:
  - **Profile**: Centered avatar, username, and level tag.
  - **Avatar**: Changed default fallback to `UserOutlined` icon on gray background.
  - **Progress Section**:
    - Renamed "Teammate Progress" to "Other Players Progress".
    - Integrated "My Status" (Submitted/Unsubmitted) into the section header.
    - Styled the section header to exactly match the player list items (white background, border, padding, rounded corners).
    - Ensured "P0 My Player" row displays all elements (Badge, Name, Status) on a single line.

## 2. Home Page (`Home.tsx`)
- **Layout Cleanup**:
  - Removed "View Registered Users" and "Online Rooms" cards (developer tools).
  - Kept only the "Quick Entry" card.
- **Quick Entry Card**:
  - Removed decorative dot from the title.
  - Centered the title and description.
  - **Start Matching Button**:
    - Forced center alignment.
    - Increased font size to **18px**.
    - Adjusted padding to **10px 24px**.
    - Removed compact (`slim`) styling for better visibility.

## 3. Rooms Page (`Rooms.tsx`)
- **Header Updates**:
  - Moved developer tools ("Registered Users", "Online Rooms") here from the Home page.
  - Added small icon buttons for these tools next to the "Game Rooms" title.
  - Integrated `UserRegistryPanel` and `OnlineRoomsPanel` components.
