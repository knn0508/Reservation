from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import ARRAY, Integer, cast, delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin
from app.core.db import get_session
from app.models.dining_table import DiningTable
from app.models.floor_plan import FloorElement, FloorPlan
from app.models.reservation import Reservation
from app.models.user import User
from app.schemas.floor_plan import (
    FloorElementOut,
    FloorPlanCreate,
    FloorPlanDetail,
    FloorPlanMeta,
    FloorPlanUpdate,
    FloorTableOut,
    LayoutSave,
)

router = APIRouter(prefix="/api/admin/floor-plans", tags=["floor-plans"])

# Fields the editor owns for a table - everything else (restaurant_id, is_active) is set here.
PLACEMENT_FIELDS = (
    "table_number",
    "category",
    "shape",
    "seats",
    "x_cm",
    "y_cm",
    "width_cm",
    "height_cm",
    "rotation",
)


async def _get_owned_plan(session: AsyncSession, plan_id: int, admin: User) -> FloorPlan:
    plan = await session.get(FloorPlan, plan_id)
    if plan is None or plan.restaurant_id != admin.restaurant_id:
        raise HTTPException(status_code=404, detail="Floor plan not found")
    return plan


async def _plan_tables(session: AsyncSession, plan_id: int) -> list[DiningTable]:
    result = await session.scalars(
        select(DiningTable)
        .where(DiningTable.floor_plan_id == plan_id, DiningTable.is_active.is_(True))
        .order_by(DiningTable.id)
    )
    return list(result)


async def _plan_elements(session: AsyncSession, plan_id: int) -> list[FloorElement]:
    result = await session.scalars(
        select(FloorElement).where(FloorElement.floor_plan_id == plan_id).order_by(FloorElement.id)
    )
    return list(result)


async def _tables_with_history(session: AsyncSession, table_ids: list[int]) -> set[int]:
    """Which of these tables a reservation has ever pointed at - those rows must survive as
    soft deletes so the history keeps resolving."""
    if not table_ids:
        return set()
    wanted = set(table_ids)
    used: set[int] = set()
    rows = await session.execute(
        select(Reservation.assigned_table_id, Reservation.merged_table_ids).where(
            or_(
                Reservation.assigned_table_id.in_(table_ids),
                # `merged_table_ids` uses the generic ARRAY type, which has no .overlap() -
                # go through the postgres && operator with an explicit cast instead.
                Reservation.merged_table_ids.op("&&")(cast(table_ids, ARRAY(Integer))),
            )
        )
    )
    for assigned, merged in rows:
        if assigned in wanted:
            used.add(assigned)
        for merged_id in merged or []:
            if merged_id in wanted:
                used.add(merged_id)
    return used


async def _detail(session: AsyncSession, plan: FloorPlan) -> FloorPlanDetail:
    return FloorPlanDetail(
        **FloorPlanMeta.model_validate(plan).model_dump(),
        tables=[FloorTableOut.model_validate(t) for t in await _plan_tables(session, plan.id)],
        elements=[FloorElementOut.model_validate(e) for e in await _plan_elements(session, plan.id)],
    )


@router.get("", response_model=list[FloorPlanMeta])
async def list_plans(
    admin: User = Depends(get_current_admin), session: AsyncSession = Depends(get_session)
):
    result = await session.scalars(
        select(FloorPlan)
        .where(FloorPlan.restaurant_id == admin.restaurant_id)
        .order_by(FloorPlan.sort_order, FloorPlan.id)
    )
    return list(result)


@router.post("", response_model=FloorPlanMeta, status_code=201)
async def create_plan(
    payload: FloorPlanCreate,
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
):
    next_order = await session.scalar(
        select(func.coalesce(func.max(FloorPlan.sort_order), -1) + 1).where(
            FloorPlan.restaurant_id == admin.restaurant_id
        )
    )
    plan = FloorPlan(
        restaurant_id=admin.restaurant_id,
        name=payload.name,
        width_cm=payload.width_cm,
        height_cm=payload.height_cm,
        sort_order=next_order or 0,
    )
    session.add(plan)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=409, detail="A plan with that name already exists")
    await session.refresh(plan)
    return plan


@router.get("/{plan_id}", response_model=FloorPlanDetail)
async def get_plan(
    plan_id: int,
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
):
    plan = await _get_owned_plan(session, plan_id, admin)
    return await _detail(session, plan)


@router.patch("/{plan_id}", response_model=FloorPlanMeta)
async def update_plan(
    plan_id: int,
    payload: FloorPlanUpdate,
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
):
    plan = await _get_owned_plan(session, plan_id, admin)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(plan, field, value)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=409, detail="Another plan already uses that name")
    await session.refresh(plan)
    return plan


@router.delete("/{plan_id}", status_code=204)
async def delete_plan(
    plan_id: int,
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
):
    plan = await _get_owned_plan(session, plan_id, admin)
    table_count = await session.scalar(
        select(func.count())
        .select_from(DiningTable)
        .where(DiningTable.floor_plan_id == plan_id, DiningTable.is_active.is_(True))
    )
    if table_count:
        raise HTTPException(
            status_code=409,
            detail=f"This plan still holds {table_count} table(s) - remove them from the canvas first",
        )
    await session.delete(plan)
    await session.commit()


@router.put("/{plan_id}/layout", response_model=FloorPlanDetail)
async def save_layout(
    plan_id: int,
    payload: LayoutSave,
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
):
    """Replace the plan's whole canvas in one transaction. Tables carry ids so reservations
    keep pointing at the same rows; elements are referenced by nothing, so they are swapped
    wholesale."""
    plan = await _get_owned_plan(session, plan_id, admin)

    existing = {t.id: t for t in await _plan_tables(session, plan_id)}
    incoming_ids = {t.id for t in payload.tables if t.id is not None}
    unknown = incoming_ids - existing.keys()
    if unknown:
        raise HTTPException(
            status_code=422, detail=f"Unknown table id(s) for this plan: {sorted(unknown)}"
        )

    seen_numbers: set[str] = set()
    for incoming in payload.tables:
        if incoming.table_number in seen_numbers:
            raise HTTPException(
                status_code=409, detail=f"Duplicate table number {incoming.table_number}"
            )
        seen_numbers.add(incoming.table_number)

    for incoming in payload.tables:
        if incoming.id is None:
            session.add(
                DiningTable(
                    restaurant_id=admin.restaurant_id,
                    floor_plan_id=plan.id,
                    zone=plan.name,
                    is_active=True,
                    **{field: getattr(incoming, field) for field in PLACEMENT_FIELDS},
                )
            )
            continue
        table = existing[incoming.id]
        for field in PLACEMENT_FIELDS:
            setattr(table, field, getattr(incoming, field))
        # `zone` predates floor plans; keep it mirroring the plan so older views stay sensible.
        table.zone = plan.name

    removed_ids = sorted(existing.keys() - incoming_ids)
    keep_ids = await _tables_with_history(session, removed_ids)
    for table_id in removed_ids:
        table = existing[table_id]
        if table_id in keep_ids:
            # Booked at some point - retire it rather than deleting the row out from under
            # the reservations that name it.
            table.is_active = False
            table.floor_plan_id = None
        else:
            await session.delete(table)

    await session.execute(delete(FloorElement).where(FloorElement.floor_plan_id == plan.id))
    for element in payload.elements:
        session.add(FloorElement(floor_plan_id=plan.id, **element.model_dump()))

    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(
            status_code=409,
            detail="A table number on this plan clashes with an existing table in this restaurant",
        )

    await session.refresh(plan)
    return await _detail(session, plan)
