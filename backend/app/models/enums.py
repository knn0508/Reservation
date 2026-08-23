import enum


class TableCategory(str, enum.Enum):
    SEATER_2 = "2_seater"
    SEATER_4 = "4_seater"


class ReservationStatus(str, enum.Enum):
    BOOKED = "booked"
    SEATED = "seated"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class ReservationEventType(str, enum.Enum):
    CREATED = "created"
    STATUS_CHANGED = "status_changed"
    DELAYED = "delayed"
    WAITLIST_PROMOTED = "waitlist_promoted"
    PREORDER_REQUESTED = "preorder_requested"


class UserRole(str, enum.Enum):
    CUSTOMER = "customer"
    ADMIN = "admin"


class MenuGroup(str, enum.Enum):
    FOOD = "food"
    BAR = "bar"


class SaleChannel(str, enum.Enum):
    # Placed through this app ahead of arrival (Reservation.preorder_items).
    ONLINE = "online"
    # Ordered in person at the restaurant - today this is synthetic/manual data; once a POS
    # exists it becomes the real feed for this channel.
    RESTAURANT = "restaurant"
