//호텔설정관련 JS코드만 분리할 예정 

// import { defaultRoomTypes } from '../config/defaultRoomTypes';
// import { v4 as uuidv4 } from 'uuid';

// const DEFAULT_FLOORS = [2, 3, 4, 5, 6, 7, 8];

// const initializedDefaultRoomTypes = defaultRoomTypes.map((rt) => ({
//   ...rt,
//   aliases: [],
//   roomNumbers:
//     rt.startRoomNumbers && Object.keys(rt.floorSettings).length > 0
//       ? Array.from(
//           { length: rt.stock },
//           (_, i) =>
//             `${
//               parseInt(rt.startRoomNumbers[Object.keys(rt.floorSettings)[0]]) +
//               i
//             }`
//         )
//       : [],
// }));

// function buildRoomTypesWithNumbers(roomTypes, containers) {
//   const cloned = roomTypes.map((rt) => ({
//     ...rt,
//     roomNumbers: [],
//   }));

//   containers.forEach((cont) => {
//     const tKey = (cont.roomInfo || '').toLowerCase();
//     const found = cloned.find(
//       (rt) => (rt.roomInfo || '').toLowerCase() === tKey
//     );
//     if (found && cont.roomNumber) {
//       found.roomNumbers.push(cont.roomNumber);
//     }
//   });

//   return cloned;
// }

// function handleLoadDefault(setRoomTypes, setFloors, setTotalRooms) {
//   const defaultRoomTypes = initializedDefaultRoomTypes.map((rt) => ({
//     ...rt,
//     aliases: [],
//     roomNumbers: [],
//   }));

//   const newFloors = DEFAULT_FLOORS.map((floorNum) => {
//     const containers = [];
//     const roomType = defaultRoomTypes.find(
//       (rt) => rt.floorSettings[floorNum] > 0
//     );
//     if (roomType) {
//       const stock = roomType.floorSettings[floorNum] || 0;
//       const startNum = parseInt(
//         roomType.startRoomNumbers[floorNum] || `${floorNum}01`,
//         10
//       );
//       for (let i = 0; i < stock; i++) {
//         const roomNum = `${startNum + i}`;
//         containers.push({
//           containerId: `${floorNum}-${roomType.roomInfo}-${roomNum}-${Date.now()}`,
//           roomInfo: roomType.roomInfo,
//           roomNumber: roomNum,
//           price: roomType.price,
//           isActive: true,
//         });
//         roomType.roomNumbers.push(roomNum);
//       }
//     }
//     containers.sort(
//       (a, b) => parseInt(a.roomNumber, 10) - parseInt(b.roomNumber, 10)
//     );
//     return { floorNum, containers };
//   });

//   defaultRoomTypes.forEach((rt) => {
//     rt.roomNumbers = [...new Set(rt.roomNumbers)];
//     rt.roomNumbers.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
//     rt.stock = rt.roomNumbers.length;
//   });

//   setRoomTypes(defaultRoomTypes);
//   setFloors(newFloors);
//   setTotalRooms(defaultRoomTypes.reduce((sum, rt) => sum + rt.stock, 0));
// }

// async function handleSaveAll(
//   hotelId,
//   isExisting,
//   totalRooms,
//   roomTypes,
//   floors,
//   hotelAddress,
//   email,
//   phoneNumber,
//   hotelName,
//   navigate
// ) {
//   if (!hotelId) {
//     alert('호텔 ID는 필수입니다.');
//     return;
//   }
//   const allHaveRoomNumbers = roomTypes.every(
//     (rt) => (rt.roomNumbers || []).length > 0
//   );
//   if (!allHaveRoomNumbers) {
//     alert('모든 객실 타입에 대해 객실 번호를 생성해야 저장할 수 있습니다.');
//     return;
//   }
//   const payload = {
//     hotelId,
//     totalRooms,
//     roomTypes: roomTypes.map((rt) => ({
//       ...rt,
//       aliases: (rt.aliases || []).filter(Boolean),
//       stock: (rt.roomNumbers || []).length,
//       floorSettings: DEFAULT_FLOORS.reduce((acc, floorNum) => {
//         const count = (rt.roomNumbers || []).filter((num) =>
//           num?.startsWith?.(String(floorNum))
//         ).length;
//         if (count > 0) acc[floorNum] = count;
//         return acc;
//       }, {}),
//       startRoomNumbers: DEFAULT_FLOORS.reduce((acc, floorNum) => {
//         const nums = (rt.roomNumbers || []).filter((num) =>
//           num?.startsWith?.(String(floorNum))
//         );
//         if (nums.length > 0) acc[floorNum] = nums[0];
//         return acc;
//       }, {}),
//     })),
//     gridSettings: {
//       floors: floors.map((floor) => ({
//         floorNum: floor.floorNum,
//         containers: floor.containers.map((cont) => ({
//           containerId: cont.containerId,
//           roomInfo: cont.roomInfo,
//           roomNumber: cont.roomNumber,
//           price: cont.price,
//           isActive: cont.isActive,
//         })),
//       })),
//     },
//     address: hotelAddress,
//     email,
//     phoneNumber,
//     hotelName,
//   };
//   try {
//     if (isExisting) {
//       console.log('호텔 설정 업데이트:', payload);
//       // await updateHotelSettings(hotelId, payload); // 실제 API 호출 필요
//       alert('업데이트 완료');
//     } else {
//       console.log('새 호텔 등록:', payload);
//       // await registerHotel(payload); // 실제 API 호출 필요
//       alert('등록 완료');
//     }
//     navigate('/');
//     window.location.reload();
//   } catch (err) {
//     console.error('저장 실패:', err);
//     alert('저장 실패: ' + err.message);
//   }
// }

// function handleCancel(
//   originalDataRef,
//   setHotelId,
//   setIsExisting,
//   setTotalRooms,
//   setRoomTypes,
//   setFloors,
//   setHotelAddress,
//   setEmail,
//   setPhoneNumber,
//   setHotelName
// ) {
//   if (!originalDataRef.current) return;
//   const orig = originalDataRef.current;
//   setHotelId(orig.hotelId);
//   setIsExisting(orig.isExisting);
//   setTotalRooms(orig.totalRooms);
//   setRoomTypes(orig.roomTypes);
//   setFloors(orig.floors);
//   setHotelAddress(orig.hotelAddress);
//   setEmail(orig.email);
//   setPhoneNumber(orig.phoneNumber);
//   setHotelName(orig.hotelName);
//   alert('변경 사항이 취소되었습니다.');
// }

// function updateContainer(floorNum, containerId, field, value, setFloors, setRoomTypes) {
//   setFloors((prev) => {
//     const updated = [...prev];
//     const floorIdx = updated.findIndex((f) => f.floorNum === floorNum);
//     if (floorIdx === -1) return prev;
//     const containerIdx = updated[floorIdx].containers.findIndex(
//       (c) => c.containerId === containerId
//     );
//     if (containerIdx === -1) return prev;
//     const container = updated[floorIdx].containers[containerIdx];
//     const oldRoomInfo = container.roomInfo;
//     container[field] = field === 'price' ? Number(value) : value;

//     if (field === 'roomInfo') {
//       if (!value || !container.roomNumber) {
//         const allRooms = updated.flatMap((f) =>
//           f.containers.filter((c) => c.roomInfo && c.roomNumber)
//         );
//         const existingNumbers = new Set(allRooms.map((c) => c.roomNumber));
//         let lastNum = parseInt(`${floorNum}01`, 10) - 1;
//         const floorRooms = allRooms.filter((c) =>
//           c.roomNumber.startsWith(floorNum.toString())
//         );
//         if (floorRooms.length > 0) {
//           lastNum = Math.max(
//             ...floorRooms.map((c) => parseInt(c.roomNumber, 10))
//           );
//         }
//         let nextNum = lastNum + 1;
//         while (
//           existingNumbers.has(
//             `${floorNum}${(nextNum - floorNum * 100)
//               .toString()
//               .padStart(2, '0')}`
//           )
//         ) {
//           nextNum++;
//         }
//         container.roomNumber = `${floorNum}${(nextNum - floorNum * 100)
//           .toString()
//           .padStart(2, '0')}`;
//       }

//       const matchingType = initializedDefaultRoomTypes.find((rt) => rt.roomInfo === value);
//       container.price = matchingType ? matchingType.price : 0;

//       const uniqueId = uuidv4();
//       container.containerId = `${floorNum}-${value}-${container.roomNumber}-${uniqueId}`;

//       setRoomTypes((prevTypes) => {
//         const updatedTypes = [...prevTypes];
//         if (oldRoomInfo && container.roomNumber) {
//           const oldIdx = updatedTypes.findIndex(
//             (rt) => rt.roomInfo === oldRoomInfo
//           );
//           if (oldIdx !== -1) {
//             updatedTypes[oldIdx].roomNumbers = updatedTypes[
//               oldIdx
//             ].roomNumbers.filter((num) => num !== container.roomNumber);
//             updatedTypes[oldIdx].stock = updatedTypes[oldIdx].roomNumbers.length;
//           }
//         }
//         if (container.roomNumber) {
//           const newIdx = updatedTypes.findIndex((rt) => rt.roomInfo === value);
//           if (
//             newIdx !== -1 &&
//             !updatedTypes[newIdx].roomNumbers.includes(container.roomNumber)
//           ) {
//             updatedTypes[newIdx].roomNumbers.push(container.roomNumber);
//             updatedTypes[newIdx].roomNumbers.sort(
//               (a, b) => parseInt(a, 10) - parseInt(b, 10)
//             );
//             updatedTypes[newIdx].stock = updatedTypes[newIdx].roomNumbers.length;
//           }
//         }
//         return updatedTypes;
//       });

//       updated[floorIdx].containers.sort(
//         (a, b) => parseInt(a.roomNumber, 10) - parseInt(b.roomNumber, 10)
//       );
//     }
//     return updated;
//   });
// }

// function removeFloor(floorNum, setFloors, setRoomTypes) {
//   setFloors((prev) => {
//     const updated = prev.filter((f) => f.floorNum !== floorNum);
//     setRoomTypes((prevTypes) =>
//       prevTypes.map((rt) => ({
//         ...rt,
//         roomNumbers: rt.roomNumbers.filter(
//           (num) => !num.startsWith(String(floorNum))
//         ),
//         stock: rt.roomNumbers.filter(
//           (num) => !num.startsWith(String(floorNum))
//         ).length,
//       }))
//     );
//     return updated;
//   });
// }

// function undoRemoveFloor(previousFloorsRef, setFloors) {
//   if (previousFloorsRef.current.length > 0) {
//     setFloors([...previousFloorsRef.current]);
//     previousFloorsRef.current = [];
//   } else {
//     alert('되돌릴 삭제가 없습니다.');
//   }
// }

// // addRoomToFloor 함수 수정
// function addRoomToFloor(floorNum, setFloors, setRoomTypes) {
//     let newRoomNumber;
//     setFloors((prev) => {
//       const updated = [...prev];
//       const floorIdx = updated.findIndex((f) => f.floorNum === floorNum);
//       if (floorIdx === -1) return prev;
  
//       const activeRooms = updated[floorIdx].containers.filter(
//         (c) => c.roomInfo && c.roomNumber
//       );
//       const allRooms = updated.flatMap((f) =>
//         f.containers.filter((c) => c.roomInfo && c.roomNumber)
//       );
//       const existingNumbers = new Set(allRooms.map((c) => c.roomNumber));
//       let lastNum = parseInt(`${floorNum}01`, 10) - 1;
//       if (activeRooms.length > 0) {
//         lastNum = Math.max(
//           ...activeRooms.map((c) => parseInt(c.roomNumber, 10))
//         );
//       }
//       let nextNum = lastNum + 1;
//       while (
//         existingNumbers.has(
//           `${floorNum}${(nextNum - floorNum * 100)
//             .toString()
//             .padStart(2, '0')}`
//         )
//       ) {
//         nextNum++;
//       }
//       newRoomNumber = `${floorNum}${(nextNum - floorNum * 100)
//         .toString()
//         .padStart(2, '0')}`;
  
//       const uniqueId = uuidv4();
//       const newContainer = {
//         containerId: `${floorNum}-${initializedDefaultRoomTypes[0].roomInfo}-${newRoomNumber}-${uniqueId}`,
//         roomInfo: initializedDefaultRoomTypes[0].roomInfo,
//         roomNumber: newRoomNumber,
//         price: initializedDefaultRoomTypes[0].price,
//         isActive: true,
//       };
//       // 중복 방지: 이미 같은 roomNumber가 있는지 확인
//       if (!updated[floorIdx].containers.some((c) => c.roomNumber === newRoomNumber)) {
//         updated[floorIdx].containers.push(newContainer);
//         updated[floorIdx].containers.sort(
//           (a, b) => parseInt(a.roomNumber, 10) - parseInt(b.roomNumber, 10)
//         );
//       }
//       return updated;
//     });
  
//     setRoomTypes((prevTypes) => {
//       const updatedTypes = [...prevTypes];
//       const typeIdx = updatedTypes.findIndex(
//         (rt) => rt.roomInfo === initializedDefaultRoomTypes[0].roomInfo
//       );
//       if (
//         typeIdx !== -1 &&
//         !updatedTypes[typeIdx].roomNumbers.includes(newRoomNumber)
//       ) {
//         updatedTypes[typeIdx].roomNumbers = (
//           updatedTypes[typeIdx].roomNumbers || []
//         ).concat([newRoomNumber]);
//         updatedTypes[typeIdx].roomNumbers.sort(
//           (a, b) => parseInt(a, 10) - parseInt(b, 10)
//         );
//         updatedTypes[typeIdx].stock = updatedTypes[typeIdx].roomNumbers.length;
//       }
//       return updatedTypes;
//     });
//   }
// function removeContainer(floorNum, containerId, setFloors, setRoomTypes) {
//   setFloors((prev) => {
//     const updated = [...prev];
//     const floorIdx = updated.findIndex((f) => f.floorNum === floorNum);
//     if (floorIdx === -1) return prev;
//     const containers = updated[floorIdx].containers;
//     const containerIdx = containers.findIndex(
//       (c) => c.containerId === containerId
//     );
//     if (containerIdx === -1) return prev;

//     const removed = containers[containerIdx];
//     containers.splice(containerIdx, 1);

//     if (removed.roomInfo && removed.roomNumber) {
//       setRoomTypes((prevTypes) => {
//         const updatedTypes = [...prevTypes];
//         const typeIdx = updatedTypes.findIndex(
//           (rt) => rt.roomInfo === removed.roomInfo
//         );
//         if (typeIdx !== -1) {
//           updatedTypes[typeIdx].roomNumbers = updatedTypes[
//             typeIdx
//           ].roomNumbers.filter((num) => num !== removed.roomNumber);
//           updatedTypes[typeIdx].stock = updatedTypes[typeIdx].roomNumbers.length;
//         }
//         return updatedTypes;
//       });
//     }

//     updated[floorIdx].containers.sort(
//       (a, b) => parseInt(a.roomNumber, 10) - parseInt(b.roomNumber, 10)
//     );
//     return updated;
//   });
// }

// function generateInitialLayout(floors, setFloors, roomTypes, setRoomTypes) {
//   const newFloors = DEFAULT_FLOORS.map((floorNum) => {
//     const containers = [];
//     roomTypes.forEach((rt) => {
//       const matchingNumbers = rt.roomNumbers.filter((num) =>
//         num.startsWith(String(floorNum))
//       );
//       matchingNumbers.forEach((num) => {
//         containers.push({
//           containerId: `${floorNum}-${rt.roomInfo}-${num}-${Date.now()}`,
//           roomInfo: rt.roomInfo,
//           roomNumber: num,
//           price: rt.price,
//           isActive: true,
//         });
//       });
//     });
//     containers.sort(
//       (a, b) => parseInt(a.roomNumber, 10) - parseInt(b.roomNumber, 10)
//     );
//     return { floorNum, containers };
//   });
//   setFloors(newFloors);
//   setRoomTypes((prevTypes) => {
//     const updatedTypes = [...prevTypes];
//     newFloors.forEach((floor) => {
//       floor.containers.forEach((cont) => {
//         if (cont.roomInfo && cont.roomNumber) {
//           const typeIdx = updatedTypes.findIndex(
//             (rt) => rt.roomInfo === cont.roomInfo
//           );
//           if (
//             typeIdx !== -1 &&
//             !updatedTypes[typeIdx].roomNumbers.includes(cont.roomNumber)
//           ) {
//             updatedTypes[typeIdx].roomNumbers.push(cont.roomNumber);
//             updatedTypes[typeIdx].stock = updatedTypes[typeIdx].roomNumbers.length;
//           }
//         }
//       });
//     });
//     return updatedTypes;
//   });
// }

// export {
//   DEFAULT_FLOORS,
//   initializedDefaultRoomTypes,
//   buildRoomTypesWithNumbers,
//   handleLoadDefault,
//   handleSaveAll,
//   handleCancel,
//   updateContainer,
//   removeFloor,
//   undoRemoveFloor,
//   addRoomToFloor,
//   removeContainer,
//   generateInitialLayout,
// };