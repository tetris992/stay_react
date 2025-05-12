// ../utils/roomUtils.js

export function buildRoomTypesWithNumbers(roomTypes, containers) {
  return roomTypes.map((rt) => {
    const fromFloors = containers
      .filter((c) => c.roomInfo === rt.roomInfo && c.isActive && c.roomNumber)
      .map((c) => c.roomNumber);

    const backup = Array.isArray(rt.roomNumbersBackup)
      ? rt.roomNumbersBackup
      : rt.roomNumbers || [];

    const merged = Array.from(new Set([...backup, ...fromFloors])).sort(
      (a, b) => parseInt(a, 10) - parseInt(b, 10)
    );

    return {
      ...rt,
      roomNumbers: merged,
      roomNumbersBackup: merged,
      stock: merged.length,
    };
  });
}
