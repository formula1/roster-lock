
# Relay Server

- Provide Client
- Manage MatchMakers
  - Add MatchMakers
  - List MatchMakers
  - Remove MatchMakers
  - Get Room Statistics (MatchMaker)
    - Number of current rooms
    - Number of successful rooms
    - Number of failed rooms
    - Room Lifetime
- Create Room
  - Only from a valid MatchMaker
- Get Users of Room
  - Only from a valid user
- Join Room
  - Only from a valid user
  - When a User sends a message, it gets relayed to all users (including sender)
  - Handles Hello and Goodbye messages

