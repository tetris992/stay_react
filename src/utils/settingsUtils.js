// utils/settingsUtils.js

/**
 * HotelSettings의 모든 필드를 포함하는 완전한 페이로드를 생성합니다.
 * @param {Object} params - 페이로드에 포함될 설정 데이터
 * @param {string} params.hotelId - 호텔 ID
 * @param {Array} [params.roomTypes=[]] - 객실 타입 배열
 * @param {Array} [params.floors=[]] - 층별 레이아웃 정보
 * @param {Array} [params.amenities=[]] - 시설 정보
 * @param {Array} [params.events=[]] - 이벤트 설정
 * @param {Array} [params.coupons=[]] - 쿠폰 설정
 * @param {string} [params.checkInTime='16:00'] - 체크인 시간
 * @param {string} [params.checkOutTime='11:00'] - 체크아웃 시간
 * @param {string} [params.hotelName=''] - 호텔 이름
 * @param {string} [params.hotelAddress=''] - 호텔 주소
 * @param {string} [params.email=''] - 호텔 이메일
 * @param {string} [params.phoneNumber=''] - 호텔 전화번호
 * @param {Object} [params.coordinates=null] - 호텔 좌표 { latitude, longitude }
 * @param {number} [params.totalRooms=0] - 총 객실 수
 * @returns {Object} 완전한 HotelSettings 페이로드
 */
export const buildFullSettingsPayload = ({
    hotelId,
    roomTypes = [],
    floors = [],
    amenities = [],
    events = [],
    coupons = [],
    checkInTime = '16:00',
    checkOutTime = '11:00',
    hotelName = '',
    hotelAddress = '',
    email = '',
    phoneNumber = '',
    coordinates = null,
    totalRooms = 0,
  }) => {
    // 필수 필드 검증
    if (!hotelId) {
      throw new Error('hotelId is required');
    }
  
    return {
      hotelId,
      roomTypes: roomTypes.map((rt) => ({
        roomInfo: rt.roomInfo || '',
        nameKor: rt.nameKor || '',
        nameEng: rt.nameEng || '',
        price: Number(rt.price) || 0,
        stock: rt.roomNumbers?.length || 0,
        aliases: (rt.aliases || []).filter(Boolean),
        roomNumbers: rt.roomNumbers || [],
        roomNumbersBackup: rt.roomNumbersBackup || rt.roomNumbers || [],
        floorSettings: rt.floorSettings || {},
        startRoomNumbers: rt.startRoomNumbers || {},
        roomAmenities: rt.roomAmenities?.map((amenity) => ({
          nameKor: amenity.nameKor || '',
          nameEng: amenity.nameEng || '',
          icon: amenity.icon || '',
          type: 'in-room',
          isActive: amenity.isActive ?? false,
        })) || [],
        photos: rt.photos || [],
        discount: Number(rt.discount) || 0,
        fixedDiscount: Number(rt.fixedDiscount) || 0,
        isBaseRoom: rt.isBaseRoom || false,
      })),
      gridSettings: {
        floors: floors.map((floor) => ({
          floorNum: floor.floorNum || 0,
          containers: (floor.containers || []).map((container) => ({
            containerId: container.containerId || `temp-${container.roomNumber || ''}`,
            roomInfo: container.roomInfo || '',
            roomNumber: container.roomNumber || '',
            isActive: container.isActive ?? true,
          })),
        })),
      },
      amenities: amenities.map((amenity) => ({
        nameKor: amenity.nameKor || '',
        nameEng: amenity.nameEng || '',
        icon: amenity.icon || '',
        type: amenity.type || 'on-site',
        isActive: amenity.isActive ?? false,
      })),
      eventSettings: events.map((event) => ({
        uuid: event.uuid || '',
        eventName: event.eventName || '특가 이벤트',
        startDate: event.startDate || '',
        endDate: event.endDate || '',
        discountType: event.discountType || 'percentage',
        discountValue: Number(event.discountValue) || 0,
        isActive: event.isActive ?? true,
        applicableRoomTypes: (event.applicableRoomTypes || []).filter(Boolean),
      })),
      coupons: coupons.map((coupon) => ({
        uuid: coupon.uuid || '',
        code: coupon.code || '',
        name: coupon.name || '할인 쿠폰',
        startDate: coupon.startDate || '',
        endDate: coupon.endDate || '',
        autoValidity: coupon.autoValidity ?? true,
        validityDays: Number(coupon.validityDays) || 30,
        discountType: coupon.discountType || 'percentage',
        discountValue: Number(coupon.discountValue) || 0,
        isActive: coupon.isActive ?? true,
        applicableRoomType: coupon.applicableRoomType || '',
        applicableRoomTypes: (coupon.applicableRoomTypes || []).filter(Boolean),
        maxUses: coupon.maxUses ? Number(coupon.maxUses) : null,
        stackWithEvents: coupon.stackWithEvents ?? false,
        usedCount: Number(coupon.usedCount) || 0,
        condition: coupon.condition || {
          type: 'none',
          value: null,
          minPrice: null,
          maxPrice: null,
        },
        isRandom: coupon.isRandom || false,
        randomMin: coupon.isRandom ? Number(coupon.randomMin) || 0 : null,
        randomMax: coupon.isRandom ? Number(coupon.randomMax) || 0 : null,
        autoDistribute: coupon.autoDistribute || false,
        issuedAt: coupon.issuedAt || '',
        usedAt: coupon.usedAt || null,
        isDeleted: coupon.isDeleted || false,
      })),
      checkInTime,
      checkOutTime,
      hotelName,
      address: hotelAddress,
      email,
      phoneNumber,
      latitude: coordinates?.latitude || null,
      longitude: coordinates?.longitude || null,
      totalRooms:
        totalRooms ||
        roomTypes.reduce((sum, rt) => sum + (rt.roomNumbers?.length || 0), 0),
    };
  };