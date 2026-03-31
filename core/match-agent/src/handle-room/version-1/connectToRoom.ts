/*
Flow
- user interacts with matchmaker
- matchmaker creates room in relay server
- matchmaker provides room id to user
- user connects to room
  - How does the relay room know it's the user
  - Signed GET parameter?
- User needs to know all the other users public keys
- User needs to know their own private key
*/

export function connectToRoom(url: string, roomId: string, userId: string, userKey: string): Promise<Room>{

}
