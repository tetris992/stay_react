{
  couponInfo && (
    <>
      <Text fontSize="sm" color="gray.600">
        적용된 쿠폰:
      </Text>
      <Text fontSize="sm" fontWeight="medium" color="teal.600">
        {couponInfo.code} (
        {couponInfo.discountType === 'percentage'
          ? `${couponInfo.discountValue}% 할인`
          : `${couponInfo.discountAmount.toLocaleString()}원 할인`}
        )
      </Text>
    </>
  );
}
