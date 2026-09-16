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
    COURIER = "courier"


class MenuGroup(str, enum.Enum):
    FOOD = "food"
    BAR = "bar"


class SaleChannel(str, enum.Enum):
    # Placed through this app ahead of arrival (Reservation.preorder_items).
    ONLINE = "online"
    # Ordered in person at the restaurant - today this is synthetic/manual data; once a POS
    # exists it becomes the real feed for this channel.
    RESTAURANT = "restaurant"


class TableShape(str, enum.Enum):
    ROUND = "round"
    SQUARE = "square"
    RECT = "rect"


class FloorElementKind(str, enum.Enum):
    """Everything on a floor plan that is not a bookable table - architecture (walls,
    windows, the entrance) and furniture/fixtures (sofas, the bar, plants)."""

    WALL = "wall"
    WINDOW = "window"
    DOOR = "door"
    ENTRANCE = "entrance"
    BAR = "bar"
    KITCHEN = "kitchen"
    SOFA = "sofa"
    BOOTH = "booth"
    PLANT = "plant"
    PILLAR = "pillar"
    STAIRS = "stairs"
    RESTROOM = "restroom"
    DIVIDER = "divider"
    LABEL = "label"


class DeliveryStatus(str, enum.Enum):
    """Lifecycle of an online delivery ("onlayn catdirilma") order.

    PLACED   - customer submitted it, no courier yet; the courier board shows it as claimable.
    ACCEPTED - a courier claimed it and is heading to the restaurant.
    PICKED_UP - order is with the courier, on the road.
    DELIVERED / CANCELLED - terminal.
    """

    PLACED = "placed"
    ACCEPTED = "accepted"
    PICKED_UP = "picked_up"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
