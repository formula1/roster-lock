// RoomManager_MessageQueue is what's actually wired up (see ../router/room.ts) -
// it runs fine as a single process against the in-memory message queue, so
// there's one code path regardless of deployment size.
// RoomManager_SingleProcess is unused; kept only as a simpler reference for
// what room lifecycle looks like without the message-queue indirection.
export * from "./versions/message-queue";
export * from "./versions/single-process";
