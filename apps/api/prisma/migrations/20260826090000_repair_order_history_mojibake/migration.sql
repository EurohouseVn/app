UPDATE "OrderStatusHistory"
SET
  "title" = 'NPP tiếp nhận',
  "note" = 'NPP đã tiếp nhận đơn hàng.'
WHERE "status" = 'NPP_REVIEWING';
