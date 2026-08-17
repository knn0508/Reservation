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


class UserRole(str, enum.Enum):
    CUSTOMER = "customer"
    ADMIN = "admin"
