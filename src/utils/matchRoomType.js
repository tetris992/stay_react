// src/utils/matchRoomType.js

import { defaultRoomTypes } from '../config/defaultRoomTypes';

/**
 * Matches the room type based on room information.
 *
 * @param {string} roomInfo - The room information string.
 * @returns {Object|null} - The matched room type object or null.
 */
export const matchRoomType = (roomInfo) => {
  if (!roomInfo) return null;

  const lowerRoomInfo = roomInfo.toLowerCase();

  for (const roomType of defaultRoomTypes) {
    const allAliases = [
      roomType.type,
      roomType.nameKor,
      roomType.nameEng,
      ...(roomType.aliases || []),
    ].map((alias) => alias.toLowerCase());

    for (const alias of allAliases) {
      if (lowerRoomInfo.includes(alias)) {
        return roomType;
      }
    }
  }

  return null;
};
