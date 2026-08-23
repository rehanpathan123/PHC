"""SQLAlchemy ORM models for PHC-Sync."""
from datetime import datetime
from typing import Optional
from sqlalchemy import (
    String, Integer, Float, DateTime, ForeignKey, Text, Index, UniqueConstraint
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20))          # ASHA | OFFICER | ADMIN
    phc_id: Mapped[Optional[int]] = mapped_column(ForeignKey("phcs.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class PHC(Base):
    __tablename__ = "phcs"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    address: Mapped[str] = mapped_column(String(200))
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    contact: Mapped[str] = mapped_column(String(30))
    district: Mapped[str] = mapped_column(String(80))

    inventory: Mapped[list["Inventory"]] = relationship("Inventory", back_populates="phc")


class Medicine(Base):
    __tablename__ = "medicines"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    category: Mapped[str] = mapped_column(String(80))
    unit: Mapped[str] = mapped_column(String(30))


class Inventory(Base):
    __tablename__ = "inventory"
    __table_args__ = (UniqueConstraint("phc_id", "medicine_id", name="uq_phc_medicine"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    phc_id: Mapped[int] = mapped_column(ForeignKey("phcs.id"), index=True)
    medicine_id: Mapped[int] = mapped_column(ForeignKey("medicines.id"), index=True)
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    minimum_stock: Mapped[int] = mapped_column(Integer, default=10)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    phc: Mapped["PHC"] = relationship("PHC", back_populates="inventory")
    medicine: Mapped["Medicine"] = relationship("Medicine")


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_code: Mapped[str] = mapped_column(String(40), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    age: Mapped[int] = mapped_column(Integer)
    gender: Mapped[str] = mapped_column(String(20))
    village: Mapped[str] = mapped_column(String(100))
    phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    existing_conditions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    phc_id: Mapped[Optional[int]] = mapped_column(ForeignKey("phcs.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    assessments: Mapped[list["Assessment"]] = relationship("Assessment", back_populates="patient")


class Assessment(Base):
    __tablename__ = "assessments"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    symptoms: Mapped[str] = mapped_column(Text)                  # JSON list
    temperature: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    heart_rate: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    spo2: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    blood_pressure: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    risk_score: Mapped[int] = mapped_column(Integer)
    risk_level: Mapped[str] = mapped_column(String(10))          # HIGH|MEDIUM|LOW
    reasons: Mapped[str] = mapped_column(Text)                   # JSON list
    recommended_action: Mapped[str] = mapped_column(Text)
    required_medicine: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    patient: Mapped["Patient"] = relationship("Patient", back_populates="assessments")


class MedicineRequest(Base):
    __tablename__ = "medicine_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[Optional[int]] = mapped_column(ForeignKey("patients.id"), nullable=True)
    medicine_id: Mapped[int] = mapped_column(ForeignKey("medicines.id"))
    source_phc_id: Mapped[int] = mapped_column(ForeignKey("phcs.id"))
    destination_phc_id: Mapped[int] = mapped_column(ForeignKey("phcs.id"))
    quantity: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="PENDING")  # PENDING|APPROVED|REJECTED|COMPLETED
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    requested_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class SyncLog(Base):
    __tablename__ = "sync_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    record_type: Mapped[str] = mapped_column(String(40))         # patient | assessment
    local_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(20))              # SYNCED | FAILED
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    synced_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AiLog(Base):
    __tablename__ = "ai_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    feature: Mapped[str] = mapped_column(String(50))
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    model: Mapped[str] = mapped_column(String(50))
    request_type: Mapped[str] = mapped_column(String(20))
    success: Mapped[bool] = mapped_column()
    latency_ms: Mapped[int] = mapped_column(Integer)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

