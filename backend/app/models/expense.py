from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, String, func
from ..core.database import Base


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    date = Column(Date, nullable=False)
    amount = Column(Float, nullable=False)       # total pagado (base + IVA)
    vat_rate = Column(Float, default=21.0)
    vat_amount = Column(Float)                   # porción de IVA

    supplier = Column(String)
    concept = Column(String)
    category = Column(String)

    # manual | foto | pdf  (email-futuro queda en el modelo de datos)
    source = Column(String, default="manual")
    file_path = Column(String)                   # ruta relativa bajo FILES_ROOT

    created_at = Column(DateTime(timezone=True), server_default=func.now())
