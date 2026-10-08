"""
WebSocket alert broadcaster for real-time push notifications.

Monitors inventory, sales, and anomalies every few seconds and pushes
alerts to all connected clients over WebSocket.
"""

import asyncio
import json
import logging
import time
from typing import Dict, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session

from ..database import get_db, SessionLocal
from .. import models
from ..resilience import log_throttled

log = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])


async def _authenticate_ws(websocket: WebSocket) -> int:
    """Validate the connecting user's token and tenant before accepting.

    The frontend appends the JWT as ?token= (browsers cannot set headers on
    WebSocket handshakes). On ANY failure the socket is closed with 4401
    BEFORE accept() so unauthenticated clients never enter the broadcast
    pool: previously anyone could subscribe to any business_id and read
    stock levels, sale amounts and anomaly stats for every tenant.
    """
    from ..core.security import decode_access_token

    token = websocket.query_params.get("token", "")
    payload = decode_access_token(token) if token else None
    user_id = payload.get("sub") if payload else None
    if not user_id:
        await websocket.close(code=4401)
        raise WebSocketDisconnect(code=4401)

    # Resolve the caller's real business membership from the DB (never trust
    # a business_id taken from the URL or even from the token claims alone).
    db = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.id == int(user_id)).first()
        if user is None or not user.is_active or user.business_id is None:
            await websocket.close(code=4403)
            raise WebSocketDisconnect(code=4403)
        return int(user.business_id)
    finally:
        db.close()


class AlertBroadcaster:
    """Manages WebSocket connections and broadcasts alerts."""

    def __init__(self):
        self.connections: Dict[str, Set[WebSocket]] = {}
        self._last_snapshot: Dict[str, dict] = {}

    async def connect(self, websocket: WebSocket, business_id: str):
        await websocket.accept()
        if business_id not in self.connections:
            self.connections[business_id] = set()
        self.connections[business_id].add(websocket)

    def disconnect(self, websocket: WebSocket, business_id: str):
        if business_id in self.connections:
            self.connections[business_id].discard(websocket)
            if not self.connections[business_id]:
                del self.connections[business_id]

    async def broadcast(self, business_id: str, alert: dict):
        if business_id not in self.connections:
            return
        dead = set()
        for ws in self.connections[business_id]:
            try:
                await ws.send_json(alert)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.connections[business_id].discard(ws)

    def get_connected_count(self) -> int:
        return sum(len(v) for v in self.connections.values())


# Global singleton
broadcaster = AlertBroadcaster()


async def _monitor_alerts():
    """Background loop that checks for new alerts every 10 seconds.

    A failed pass backs off, and its log line is throttled: this loop ticks
    every 10 seconds, so during a Neon outage it used to write the same warning
    six times a minute. The loop IS the retry mechanism for this task — a
    transient resolver/socket failure clears within a few seconds.
    """
    failures = 0
    while True:
        await asyncio.sleep(10)
        db = SessionLocal()
        try:
            # Get all unique business IDs
            business_ids = set()
            for biz_id in (
                db.query(models.Sale.business_id)
                .distinct()
                .all()
            ):
                if biz_id[0] is not None:
                    business_ids.add(str(biz_id[0]))

            # Also check products for stock alerts
            all_products = db.query(models.Product).all()
            product_biz_ids = set()
            for p in all_products:
                if p.business_id is not None:
                    product_biz_ids.add(str(p.business_id))
            business_ids.update(product_biz_ids)

            for biz_id in business_ids:
                if biz_id not in broadcaster.connections:
                    continue

                prev = broadcaster._last_snapshot.get(biz_id, {})
                new_snapshot = {}

                # ── Inventory alerts ──
                products = (
                    db.query(models.Product)
                    .filter(models.Product.business_id == int(biz_id))
                    .all()
                )
                low_stock = []
                out_of_stock = []
                for p in products:
                    if p.stock_quantity <= 0:
                        out_of_stock.append(p)
                    elif p.stock_quantity <= (p.reorder_threshold or 10):
                        low_stock.append(p)

                new_snapshot["low_stock"] = {p.id: p.stock_quantity for p in low_stock}
                new_snapshot["out_of_stock"] = {p.id: True for p in out_of_stock}

                # Detect new low-stock items
                prev_low = prev.get("low_stock", {})
                for p in low_stock:
                    if p.id not in prev_low or prev_low[p.id] != p.stock_quantity:
                        await broadcaster.broadcast(biz_id, {
                            "type": "low_stock",
                            "message": f"{p.name}: only {p.stock_quantity} left (threshold: {p.reorder_threshold or 10})",
                            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
                            "product_id": p.id,
                            "stock": p.stock_quantity,
                            "threshold": p.reorder_threshold or 10,
                        })

                # Detect new out-of-stock items
                prev_out = prev.get("out_of_stock", {})
                for p in out_of_stock:
                    if p.id not in prev_out:
                        await broadcaster.broadcast(biz_id, {
                            "type": "out_of_stock",
                            "message": f"{p.name} is out of stock!",
                            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
                            "product_id": p.id,
                        })

                # ── Sales alerts ──
                sales = (
                    db.query(models.Sale)
                    .filter(models.Sale.business_id == int(biz_id))
                    .order_by(models.Sale.id.desc())
                    .limit(5)
                    .all()
                )
                new_snapshot["sales_count"] = len(sales)
                prev_count = prev.get("sales_count", 0)

                if prev_count > 0 and len(sales) > prev_count:
                    for s in sales[: len(sales) - prev_count]:
                        if (s.total_amount or 0) > 5000:
                            await broadcaster.broadcast(biz_id, {
                                "type": "sale_high",
                                "message": f"High-value sale: ₹{s.total_amount:,.0f}",
                                "timestamp": str(s.sale_date) if s.sale_date else time.strftime("%Y-%m-%dT%H:%M:%S"),
                                "sale_id": s.id,
                                "amount": float(s.total_amount or 0),
                            })

                # ── Anomaly alerts (check recent sales for unusual patterns) ──
                try:
                    recent_sales_list = (
                        db.query(models.Sale)
                        .filter(models.Sale.business_id == int(biz_id))
                        .order_by(models.Sale.id.desc())
                        .limit(20)
                        .all()
                    )
                    if recent_sales_list:
                        amounts = [float(s.total_amount or 0) for s in recent_sales_list]
                        mean_amt = sum(amounts) / len(amounts)
                        std_amt = (sum((a - mean_amt) ** 2 for a in amounts) / len(amounts)) ** 0.5
                        anomaly_count = sum(1 for a in amounts if a > mean_amt + 2 * std_amt and a > 1000)
                        new_snapshot["anomaly_count"] = anomaly_count
                        prev_anomaly = prev.get("anomaly_count", 0)
                        if prev_anomaly == 0 and anomaly_count > 0:
                            await broadcaster.broadcast(biz_id, {
                                "type": "anomaly",
                                "message": f"Detected {anomaly_count} unusual transactions (statistical anomaly)",
                                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
                                "severity": "medium",
                                "count": anomaly_count,
                            })
                except Exception as exc:
                    import logging
                    logging.warning(f"Anomaly detection failed for biz {biz_id}: {exc}")

                broadcaster._last_snapshot[biz_id] = new_snapshot

        except Exception as exc:
            # `biz_id` is NOT necessarily bound here — the failure can happen
            # while loading the business list, before the per-business loop
            # assigns it. Referencing it made this handler raise
            # UnboundLocalError inside itself, killing the monitor task instead
            # of logging the problem. Report the pass instead.
            failures += 1
            log_throttled(
                log,
                "alert-monitor",
                f"Alert monitor pass failed: {type(exc).__name__}: {exc}",
                min_interval=300.0,
            )
        else:
            failures = 0
        finally:
            db.close()

        if failures:
            # Back off on a sustained outage instead of re-hammering the
            # database every 10 seconds.
            await asyncio.sleep(min(10 * failures, 120))


@router.on_event("startup")
async def start_alert_monitor():
    """Start the background alert monitoring loop."""
    asyncio.create_task(_monitor_alerts())


@router.websocket("/ws/alerts/{business_id}")
async def websocket_alerts(websocket: WebSocket, business_id: str):
    """Authenticated WebSocket endpoint for real-time alerts.

    Connect: ws://host/ws/alerts/{business_id}?token=<JWT>

    The token must belong to an active user; the subscription is forced to
    that user's own business (a valid token for another tenant's id is
    remapped, not honoured).

    Messages sent by server:
    {
        "type": "low_stock" | "out_of_stock" | "sale_high" | "anomaly",
        "message": "...",
        "timestamp": "2026-09-03T21:45:00",
        ...additional fields
    }
    """
    # Authenticate BEFORE accepting the socket (the helper is async: it
    # awaits websocket.close on every failure path).
    user_business_id = await _authenticate_ws(websocket)

    # Never trust the URL's business_id: pin the subscription to the
    # authenticated user's own tenant.
    business_id = str(user_business_id)
    await broadcaster.connect(websocket, business_id)
    try:
        # Send initial snapshot on connect
        db = SessionLocal()
        try:
            products = (
                db.query(models.Product)
                .filter(models.Product.business_id == int(business_id))
                .all()
            )
            low_count = sum(1 for p in products if 0 < p.stock_quantity <= (p.reorder_threshold or 10))
            out_count = sum(1 for p in products if p.stock_quantity <= 0)
            await websocket.send_json({
                "type": "connected",
                "message": f"Connected — {low_count} low stock, {out_count} out of stock",
                "low_stock_count": low_count,
                "out_of_stock_count": out_count,
                "connected_clients": broadcaster.get_connected_count(),
            })
        except Exception:
            await websocket.send_json({"type": "connected", "message": "Connected to alerts stream"})
        finally:
            db.close()

        # Keep connection alive, handle client messages
        while True:
            data = await websocket.receive_text()
            # Client can send pings or config changes
            try:
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
            except json.JSONDecodeError:
                pass  # Client sent non-JSON, ignore silently

    except WebSocketDisconnect:
        broadcaster.disconnect(websocket, business_id)
    except Exception:
        broadcaster.disconnect(websocket, business_id)
